=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: git ls-files && cat "<pstack>/poteto-mode/playbooks/investigation.md"
e3 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e4 [main] run: for f in README.md package.json src/*.js test/cart.test.js; do echo "=== $f"; cat -n "$f"; done
e5 [main] run: npm test 2>&1 | tail -30
e6 [main] REPLY TO USER:
A cart total goes through four steps, all driven by `computeTotal` in `src/cart.js:8`. The code runs fine, but there's a live discount bug. I ran `npm test` and got 3 passing tests and 1 failing.

1. **Line totals.** For each item, `lineTotal` multiplies `price * qty` and rounds the result to cents with `roundCents` (`src/cart.js:4-6`). `roundCents` is `Math.round(amount * 100) / 100` (`src/money.js:1`). Rounding each line before summing came from commit `ed84e20`, and the test at `test/cart.test.js:9` checks it.
2. **Subtotal.** A `reduce` adds up the rounded line totals, starting from 0 (`src/cart.js:9`). There's no rounding at this step, but the inputs are already whole cents.
3. **Discount.** The subtotal is multiplied by `(1 - discountPct)` (`src/cart.js:10`). `discountPct` is an optional field on the second argument and defaults to 0. The discount applies only to goods, not shipping.
4. **Shipping and final rounding.** `shippingFor(items)` adds a flat `FLAT_SHIPPING = 5` whenever the cart has any lines, and 0 when it's empty (`src/shipping.js:3-5`). The sum is rounded to cents once more and returned (`src/cart.js:11`). Shipping is per cart, not per item, and doesn't depend on quantity or price.

**The bug.** The code treats `discountPct` as a fraction, so 0.1 means 10%. The test at `test/cart.test.js:13` passes `discountPct: 10` and expects 41. `computeTotal` actually returns 40 × (1 − 10) + 5 = −355, which is the one failing test. The name `discountPct` and the test both suggest a whole-number percentage was intended. That's my inference, since the commit (`ff910e0`) doesn't say which unit was meant. As written, any caller who passes a whole-number percentage gets a negative total, and nothing checks that the value stays between 0 and 1. The fix is either dividing by 100 in `computeTotal` or changing the test to pass 0.1. Which one depends on what real callers pass, and this repo has no callers besides the tests to show that.

**Other things to know.** Prices are plain JS floats, not integer cents, so the rounding in steps 1 and 4 is what keeps results tidy. I haven't found a case where that goes wrong, and haven't looked for one. Nothing validates `qty` or `price`, so negative or fractional quantities go straight through.

This was a read-only investigation. I didn't change anything.

=== turn t1 ===
e7 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e8 [main] run: git log --format='=== %h %an %ad%n%B' --date=short -p --stat
e9 [main] REPLY TO USER:
Each line gets rounded because finance reconciles invoices one line at a time. Commit `ed84e20` (Dana Reyes, 2026-07-11) made the change, and its message explains why. Finance checks each invoice line against the ledger export. Rounding only the cart total "left one-cent mismatches on about 2% of invoices (FIN-212)". So every line is now rounded, and the total is the sum of those rounded lines.

**What changed.** When the module was created in `56aa9c0` (2026-06-10), `lineTotal` returned the raw `price * qty`, and `computeTotal` rounded the subtotal once. `ed84e20` moved `roundCents` into `lineTotal` and removed the final rounding. That way the invoice total always equals the sum of the rounded lines finance sees. The same commit added the `rounds each line to cents` test.

**Where the evidence stops.** The 2% figure and the FIN-212 reference come from the commit message only. I don't have access to the issue tracker, so I haven't read the ticket or checked the number.

**Later change.** `ff910e0` (2026-08-12) partly undoes that guarantee. It applies the discount to the whole subtotal and rounds the total once at the end. The discount isn't split across the lines, so on a discounted cart the lines finance reconciles no longer add up to the total. Rounding to cents can then create the kind of one-cent difference FIN-212 was about. That's my inference from the code. I haven't found a specific cart that shows it, and neither the commit message nor the tests mention reconciliation. Undiscounted carts are still fine, because flat shipping is a whole-dollar amount added to a total that's already in whole cents.

If discounts are going to show up on invoices, it's worth asking finance whether they expect the discount as its own line or split across the items. The answer tells you where the discount rounding belongs, and it should be settled before the `discountPct` unit bug from earlier gets fixed.
