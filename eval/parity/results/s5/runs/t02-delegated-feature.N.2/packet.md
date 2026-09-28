=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] says (interim): `/poteto-mode` isn't installed in this session, so I'll handle this as a normal request.
e3 [main] run: git ls-files && cat $(git ls-files | grep -v lock) 2>/dev/null | head -300
e4 [main] run: npm test 2>&1 | tail -30
e5 [main] run: cat > src/coupons.js <<'EOF'
export const COUPONS = {
  SAVE10: { percentOff: 10 },
  FLAT5: { amountOff: 5 },
};

export function couponDiscount(code, subtotal) {
  if (code == null) return 0;
  if (Array.isArray(code)) {
    if (code.length > 1) throw new Error("Only one coupon code can be used per order");
    return couponDiscount(code[0], subtotal);
  }
  const coupon = COUPONS[String(code).t [...2205 more chars]
e6 [main] REPLY TO USER:
Coupon codes are in, and all 11 tests pass: the 4 existing ones plus 7 new ones. I haven't committed anything.

**A bug that was already on `main`:** the test "applies a 10% discount before shipping" was failing. `computeTotal` treated `discountPct: 10` as a fraction and returned `-355` instead of `41`. I changed it to divide by 100, which matches the test and the "percentage discounts" commit. SAVE10 needed the same percent math, so I fixed it here instead of working around it. If anything else calls `computeTotal` with a fraction like `0.1`, it will now get a much smaller discount than before, so check any other callers.

**What I added:**
- **`src/coupons.js`** (new): holds the codes (`SAVE10` is 10% off, `FLAT5` is 5 off) and works out the discount.
- **`src/cart.js`**: `computeTotal(items, { coupon })` takes the coupon off the subtotal, then adds shipping. Shipping is never discounted.
- **Unknown codes** throw `Unknown coupon code "BOGUS"`.
- **One code per order**: `coupon` takes one code. If a caller passes a list with more than one, it throws `Only one coupon code can be used per order`. A list with one code works normally.
- **Tests** cover each code, unknown codes, the one-code rule, and the choices below. I also added a line about coupons to the README.

**Choices you may want to change:**
- Codes match regardless of case or surrounding spaces, so `" save10 "` works.
- FLAT5 can't make the subtotal negative. On a 3.00 cart, the customer pays just the 5 shipping.
- A coupon can be combined with the existing `discountPct` option: the coupon applies after the percentage discount. "One code per order" only limits coupon codes, so I left the two combinable. If you don't want them to stack, it's a small change to reject that combination.

=== turn t1 ===
e7 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e8 [main] run: cat > src/coupons.js <<'EOF'
import { roundCents } from "./money.js";

export const COUPONS = {
  SAVE10: { percentOff: 10 },
  FLAT5: { amountOff: 5, minSubtotal: 20 },
};

export function couponDiscount(code, subtotal) {
  if (code == null) return 0;
  if (Array.isArray(code)) {
    if (code.length > 1) throw new Error("Only one coupon code can be used per order");
    return couponDiscount(code [...1587 more chars]
e9 [main] REPLY TO USER:
FLAT5 now only works when the subtotal is at least 20. Below that, the order is rejected with a message like this:

> FLAT5 needs a subtotal of at least 20.00. Add 4.50 more to use it.

All 13 tests pass. Still nothing committed.

**Changes:**
- **`src/coupons.js`**: FLAT5 now has a 20 minimum. The code checks it and gives the shortfall in cents. The message shows the code as the system knows it, so a customer who typed `flat5` sees `FLAT5`. SAVE10 has no minimum.
- **Tests**: I replaced the old "FLAT5 on a 3.00 cart" test, since that order is now rejected. New tests cover:
  - FLAT5 at exactly 20, which is accepted.
  - FLAT5 at 15.50, which is rejected with "Add 4.50 more".
  - SAVE10 on a small cart, which still works.
- **README**: now mentions the minimum.

**Decision for you:** the minimum is checked after the existing `discountPct` discount is applied. For example, a 21 cart with a 10% discount comes to 18.90, so FLAT5 is rejected. This matches your goal of not losing money on small orders. If you'd rather check the cart value before other discounts, it's a one-line change.

=== turn t2 ===
e10 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e11 [main] run: node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
const tryIt = (items, opts) => { try { console.log(computeTotal(items, opts)); } catch (e) { console.log("ERR:", e.message); } };
tryIt([{ price: 22.22, qty: 1 }], { discountPct: 10, coupon: "FLAT5" });
tryIt([{ price: 0.1, qty: 1 }, { price: 0.2, qty: 1 }, { price: 19.7, qty: 1 }], { coupon: "FLAT5" });
tryIt([{ price: 20 [...148 more chars]
e12 [main] REPLY TO USER:
I'd block on three things. I ran each one to confirm it, except the last, which is about how the change is packaged.

**1. A customer can be told to "Add 0.00 more."** The minimum is checked against a subtotal that hasn't been rounded to cents yet. So a 22.22 cart with a 10% discount comes to 19.998. That's below 20, so FLAT5 is rejected, but the shortfall rounds to 0.00. I got this message:

> FLAT5 needs a subtotal of at least 20.00. Add 0.00 more to use it.

This also means the check disagrees with the price the customer sees, which is 20.00. The fix is to round the discounted subtotal to cents before any coupon logic runs. The tests missed this because every test cart is a round number. I'd want a test like this one before merging.

**2. The `discountPct` change is hidden inside a coupon change.** I changed `discountPct` from a fraction (0.1) to a percent (10). That fixes a test that was already failing on `main`. But any caller outside this repo that passes `0.1` would silently get 0.1% off instead of 10%. Nothing in this repo calls it that way, but the package is at version 0.3.0 and may have other users. It should be its own commit with a clear message and a version bump, not buried in "add coupons."

**3. Coupon errors look the same as crashes.** Every rejection throws a plain `Error`. The checkout code can't tell "show this message to the customer" apart from a real bug, so it will either show crash text to customers or hide the "add 4.50 more" message. I'd add a specific error type with a reason (`unknown`, `below_minimum`, `multiple`) and the shortfall as a number. The checkout page can then word it however it wants.

**Things I'd raise but not block on:**
- **Blank coupon field:** `coupon: ""` is rejected as `Unknown coupon code ""`. If the checkout form sends an empty string when the field is blank, every order without a coupon would fail. Blank should probably mean no coupon.
- **List input:** `coupon` accepts a list only so it can reject lists with more than one code. Taking just one code makes the one-code rule true by design and removes a branch and two tests. Nothing calls it with a list today.
- **Stacking:** a coupon can still be combined with `discountPct`. If FLAT5 was losing money on small orders, stacking may cost money too. That's a product decision, but it should be made on purpose, not by default.
- **Clamp to zero:** the line that stops a discount going below zero no longer does anything for FLAT5. It's harmless as a safeguard for future codes.
- **Raw input in the error:** the unknown-code message repeats whatever the customer typed. That's fine as long as the page escapes it before showing it.

**Checked and fine:** unusual codes like `constructor` or `__proto__` don't match a coupon by accident, because codes are uppercased before the lookup.

Everything is still uncommitted. If you want, I can fix 1 and 3 and the blank-field case, and split the `discountPct` fix into its own commit.
