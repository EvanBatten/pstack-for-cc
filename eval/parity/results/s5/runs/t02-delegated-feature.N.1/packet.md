=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v lock) 2>/dev/null | head -300
e3 [main] run: npm test 2>&1 | tail -30
e4 [main] run: cat > src/coupons.js <<'EOF'
import { roundCents } from "./money.js";

export const COUPONS = {
  SAVE10: (subtotal) => subtotal * 0.1,
  FLAT5: (subtotal) => Math.min(5, subtotal),
};

export class CouponError extends Error {
  constructor(message) {
    super(message);
    this.name = "CouponError";
  }
}

export function couponDiscount(code, subtotal) {
  if (code == null) return 0;
  if (typeo [...2565 more chars]
e5 [main] REPLY TO USER:
I added the two coupon codes to the cart, and all 12 tests pass (4 existing, 8 new). There's no `/poteto-mode` command in this session, so I did this as a normal request.

**A bug I fixed first:** one existing test was already failing. `computeTotal` treated `discountPct` as a fraction, so the test's `discountPct: 10` gave a total of −355 instead of 41. The test and the last commit both mean 10 as 10%, so I changed the formula in `src/cart.js` to `1 - discountPct / 100`. If any caller elsewhere passes a fraction like `0.1`, it will now get 0.1% off instead of 10%.

**How coupons work** (new file `src/coupons.js`):
- **Using a code:** pass it as `computeTotal(items, { coupon: "SAVE10" })`.
- **SAVE10** takes 10% off the subtotal. The discount is rounded to cents, and shipping is never discounted.
- **FLAT5** takes 5 off the subtotal. It can't take the subtotal below zero, so a 3.00 cart pays only the 5 shipping.
- **Unknown codes** throw a `CouponError` with the message `Coupon code "BOGUS" is not valid.`
- **One code per order:** only a single string is accepted. Passing a list throws `Only one coupon code can be applied per order.`
- **Typing variations:** codes ignore case and extra spaces, so `" save10 "` works.

**Decisions you may want to change:**
- **Case and spaces:** accepting `" save10 "` was my choice. Remove it if codes should match exactly.
- **With `discountPct`:** the coupon applies after the percentage discount, not to the original subtotal.
- **Where it lives:** there's no cart object that stores a code, so the coupon goes in as an option to `computeTotal`.

The new tests are in `test/cart.test.js`, and I added a line about coupons to the README. Nothing is committed yet.

=== turn t1 ===
e6 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e7 [main] run: cat > src/coupons.js <<'EOF'
import { roundCents } from "./money.js";

export const COUPONS = {
  SAVE10: { discount: (subtotal) => subtotal * 0.1 },
  FLAT5: { minSubtotal: 20, discount: () => 5 },
};

export class CouponError extends Error {
  constructor(message) {
    super(message);
    this.name = "CouponError";
  }
}

export function couponDiscount(code, subtotal) {
  if (code == null) retu [...1802 more chars]
e8 [main] run: grep -n "Add 2" test/cart.test.js
e9 [main] REPLY TO USER:
FLAT5 now only works when the subtotal is at least 20. Below that it's rejected with an error, for example: `FLAT5 needs a subtotal of at least 20.00. Add 4.50 more to use it.` All 14 tests pass.

- **Rule:** in `src/coupons.js`, each coupon can now have an optional minimum subtotal. FLAT5's is 20, and a subtotal of exactly 20 still gets the discount. SAVE10 has no minimum.
- **Removed:** the old rule that stopped FLAT5 taking a subtotal below zero. It can't happen anymore, since the coupon only applies at 20 or more. I replaced its test with three new ones: an order of exactly 20 is accepted, one below 20 is rejected with the right message, and a percentage discount can push an order below the minimum.
- **README:** updated to mention the minimum.

**Decision for you:** the 20 minimum is checked after any `discountPct` discount. A 20.00 order with 10% off is 18.00, so FLAT5 is rejected with "Add 2.00 more". That protects your margin better, but a customer might expect the minimum to apply to their total before discounts. It's a one-line change if you want it that way.

Amounts in the message show two decimals and no currency symbol, because the rest of the code doesn't use one. Nothing is committed yet.

=== turn t2 ===
e10 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e11 [main] run: git status --short && git diff && cat src/coupons.js && git log -p --follow -- src/cart.js | head -60
e12 [main] run: cat > /tmp/probe.mjs <<'EOF'
import { computeTotal, lineTotal } from "<repo>/src/cart.js";
const t = (label, f) => { try { console.log(label, "=>", f()); } catch (e) { console.log(label, "=> THROWS", e.message); } };
// float noise at the FLAT5 threshold: find line combos that should sum to exactly 20
const hits = [];
for (let a = 1; a < 2000 && hits.length < 3; a++) {
  const items = [{ price: a  [...1160 more chars]
e13 [main] run: sed -i 's#"<repo>/src/cart.js"#"file:///<repo>/src/cart.js"#' /tmp/probe.mjs && node /tmp/probe.mjs
e14 [main] REPLY TO USER:
I'd block this on three things. I ran the edge cases against the current code rather than just reading it, so the numbers below are real outputs. All 14 tests pass, but they don't cover any of these cases.

### Blockers

**1. Customers can be told "Add 0.00 more" when their subtotal shows as 20.00.**
In `src/cart.js:11`, the subtotal after `discountPct` is never rounded to cents. FLAT5 then checks that unrounded number against the 20 minimum.
- 22.22 with 10% off comes out as 19.998, which displays as 20.00. FLAT5 is rejected with `Add 0.00 more to use it.`
- 21.05 with 5% off does the same.

SAVE10 is also worked out from the unrounded amount. Commit ed84e20 explains that finance reconciles invoices line by line and cent-level drift caused FIN-212. So each discount should be rounded to cents before anything else uses it. The fix is to round the discounted subtotal first, plus a threshold test like 22.22 with 10% off.

**2. The `discountPct` fix quietly changes what an existing option means.**
In my first change I switched `discountPct` from a fraction (`0.1`) to a percentage (`10`) to fix the failing test. The test and commit message support that reading, but the code as committed took a fraction. Any caller outside this repo still passing `0.1` would now get 0.1% off: a 40 cart totals 44.96 instead of 41, so customers get almost none of the discount they were promised. That shouldn't be buried in a coupon PR. It needs its own commit, and someone has to check every caller first. Also, nothing limits the value: `discountPct: 150` gives a total of **−15**.

**3. An empty coupon field blocks checkout.**
`coupon: ""` and `coupon: "  "` both throw `Coupon code "" is not valid.` If the checkout form always sends the coupon field, every order without a coupon fails. Blank or whitespace-only codes should count as no coupon, with a test for it.

### Worth fixing, not blocking

- **Error message echoes raw input:** the "not valid" message includes whatever the customer typed, untrimmed. That's fine if the UI escapes it, but it's worth a note wherever it gets displayed.
- **Code lookup:** `COUPONS[normalized]` is a plain object lookup. Uppercasing happens to stop codes like `constructor` from matching built-in properties, but `Object.hasOwn` would make that safe on purpose. `COUPONS` is also exported and can be modified by other code.
- **Discount stacking hasn't been decided:** "one code per order" holds, but a code still stacks with `discountPct`. That's a product call, and the PR should say which way was chosen.
- **FLAT5 on an empty cart** tells the customer to "Add 20.00 more". That's correct, but the wording is odd.
- **One file isn't tracked yet:** `src/coupons.js` hasn't been added to git, so a commit made with `git commit -a` would leave it out.

Blockers 1 and 3 are small code changes, each with a test. Blocker 2 needs you to check who calls `discountPct` before I split it into its own commit. Do you want me to make those changes?
