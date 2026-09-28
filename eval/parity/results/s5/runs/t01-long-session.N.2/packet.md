=== turn t0 ===
e1 [main] USER: /poteto-mode npm test fails on the 10% discount case in the cart. Fix it.
e2 [main] run: ls && cat package.json && git ls-files && npm test 2>&1 | tail -40
e3 [main] run: cat src/*.js test/cart.test.js README.md
e4 [main] run: git show ff910e0 --stat --format='%an %s%n%b' && grep -rn discount --exclude-dir=node_modules .
e5 [main] says (interim): `discountPct` is a percentage (the name, commit message, and test all say "10%"), but the code treats it as a fraction: `40 * (1 - 10) = -360`. Fixing the code, not the test.
e6 [main] edit <repo>/src/cart.js
e7 [main] run: npm test 2>&1 | grep -E '^(✔|✖|ℹ (pass|fail))'
e8 [main] REPLY TO USER:
I fixed the 10% discount bug, and `npm test` now passes all 4 tests.

**Cause:** `computeTotal` in `src/cart.js` treated `discountPct` as a fraction, but callers pass a whole percentage like `10`. That turned a $40 cart into `40 * (1 - 10) + 5 = -355` instead of `36 + 5 = 41`.

**Fix:** In `src/cart.js:10` I changed `(1 - discountPct)` to `(1 - discountPct / 100)`. I fixed the code rather than the test because the parameter name, the commit message ("percentage discounts") and the test name all mean a whole number like `10`. The test is the only caller.

Nothing is committed yet.

Also, `/poteto-mode` isn't installed in this session, so it didn't run. I did the fix without it.

=== turn t1 ===
e9 [main] USER: thanks, looks good
e10 [main] REPLY TO USER:
You're welcome. The change is still uncommitted; I can commit it if you want.

=== turn t2 ===
e11 [main] USER: Add a free-shipping rule: orders over 50 after the discount ship free. Include it in the cart total.
e12 [main] run: cat > src/shipping.js <<'EOF'
export const FLAT_SHIPPING = 5;
export const FREE_SHIPPING_OVER = 50;

export function shippingFor(items, subtotal) {
  if (items.length === 0 || subtotal > FREE_SHIPPING_OVER) return 0;
  return FLAT_SHIPPING;
}
EOF
cat > src/cart.js <<'EOF'
import { roundCents } from "./money.js";
import { shippingFor } from "./shipping.js";

export function lineTotal(item) {
  retu [...872 more chars]
e13 [main] REPLY TO USER:
Orders over 50 after the discount now ship free, and the cart total includes it. All 7 tests pass: the 4 existing ones and 3 new ones.

**Changes:**
- **`src/shipping.js`:** `shippingFor(items, subtotal)` now also takes the discounted subtotal. It returns 0 for an empty cart or when that subtotal is over `FREE_SHIPPING_OVER` (50). Otherwise it charges the $5 flat rate.
- **`src/cart.js`:** `computeTotal` rounds the discounted subtotal to cents before comparing it to 50, so float noise can't tip a $50.00 order into free shipping.

**New tests:**
- $60 with 10% off → $54, shipping is free.
- Exactly $50 still pays shipping → $55, since the rule is strictly "over 50".
- $55 with 10% off drops to $49.50 → shipping applies, $54.50.

**Behavior change:** the discounted subtotal is now rounded to cents before shipping is added. Totals are still rounded at the end, so this should only matter in rare half-cent cases.

The README still only says "charges flat shipping". I can update it or commit if you'd like.
