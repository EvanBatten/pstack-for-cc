=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: git ls-files | head -100
e3 [main] read <repo>/src/cart.js (full)
e4 [main] read <repo>/src/money.js (full)
e5 [main] read <repo>/src/shipping.js (full)
e6 [main] read <repo>/test/cart.test.js (full)
e7 [main] run: node --test 2>&1 | tail -30
e8 [main] REPLY TO USER:
`computeTotal` in `src/cart.js` does it in four steps: round each line to cents, add the lines up, apply the discount to that sum, then add shipping and round once more. One thing to know first: the discount step disagrees with its test. `discountPct` is used as a fraction, but the test passes `10`, and that test fails when I run it.

```1:12:src/cart.js
import { roundCents } from "./money.js";
import { shippingFor } from "./shipping.js";

export function lineTotal(item) {
  return roundCents(item.price * item.qty);
}

export function computeTotal(items, { discountPct = 0 } = {}) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discounted = subtotal * (1 - discountPct);
  return roundCents(discounted + shippingFor(items));
}
```

1. **Line totals:** `lineTotal` multiplies `price * qty` and rounds each line to cents with `roundCents`, which is `Math.round(amount * 100) / 100` in `src/money.js`.
2. **Subtotal:** `reduce` adds up the rounded line totals. The sum isn't rounded again here.
3. **Discount:** the subtotal is multiplied by `(1 - discountPct)`. It applies before shipping, and shipping is never discounted.
4. **Shipping and final rounding:** `shippingFor` in `src/shipping.js` adds a flat `$5` if the cart has any items and `$0` if it's empty. The number of items and their price don't change it. The sum is rounded to cents once more and returned.

For example, `[{price: 2.5, qty: 2}, {price: 1, qty: 3}]` gives lines of 5 and 3, a subtotal of 8, and a total of 13 after shipping.

**The discount mismatch:** the code treats `discountPct` as a fraction, so 10% would be `0.1`. The test `applies a 10% discount before shipping` passes `{ discountPct: 10 }` and expects `41`. The code computes `40 * (1 - 10) + 5 = -355`, and `node --test` confirms it: 3 tests pass and this one fails with `-355 !== 41`. Either the test should pass `0.1`, or the code should divide by 100. Nothing checks the input, so any value above 1 gives a negative total.

I didn't recognize `/poteto-mode`, so I just answered the question directly.

=== turn t1 ===
e9 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e10 [main] run: git log --stat --format="--- %h %an %ad%n%B" --date=short && git log -p --format="=== %h %s" -- src/cart.js src/money.js
e11 [main] run: cat README.md; git show ff910e0 -- test/cart.test.js
e12 [main] REPLY TO USER:
Finance reconciles invoices line by line, so each line is rounded to make the invoice lines add up exactly to the total. It started out rounding the total once and was changed on purpose.

The history has three commits:

- **`56aa9c0` (2026-06-10):** the first version. `lineTotal` returned the raw `price * qty` and `computeTotal` rounded the subtotal once.
- **`ed84e20` (2026-07-11), "round each line to cents before summing":** this moved the rounding into `lineTotal` and dropped the final round. The commit message gives the reason:

  > Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

  If you round only the total, the rounded lines printed on an invoice can add up to a cent more or less than the total. Rounding each line first means the total is always exactly their sum. The same commit added the `rounds each line to cents` test.
- **`ff910e0` (2026-08-12), "add flat shipping and percentage discounts":** this added shipping, the discount and a final `roundCents` around `discounted + shipping`.

That last commit partly undoes the FIN-212 guarantee. The discount is applied to the whole subtotal instead of to each line, so once a discount applies, the total no longer has to equal the sum of the rounded line amounts. Line-by-line reconciliation can drift by a cent again on discounted carts. Nothing in the history says whether that was intended, and no test covers a discount that produces fractional cents.

The same commit also added the failing discount test from before. The test passed `discountPct: 10` while the code expects a fraction, so that test has failed since the day it was added.
