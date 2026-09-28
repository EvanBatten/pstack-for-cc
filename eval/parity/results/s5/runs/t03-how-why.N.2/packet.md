=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: git ls-files && git ls-files | grep -v -E '\.(lock|png)$' | xargs -I{} sh -c 'echo "=== {}"; cat -n "{}"' | head -400
e3 [main] run: npm test 2>&1 | tail -30
e4 [main] REPLY TO USER:
`/poteto-mode` isn't installed in this session, so I answered your question directly from the code.

## From line items to the total

Everything happens in `computeTotal` in `src/cart.js:8`, which takes `items` and an optional `{ discountPct }`:

1. **Line totals** (`src/cart.js:4`): each item's total is `roundCents(item.price * item.qty)`. `roundCents` (`src/money.js:1`) is `Math.round(amount * 100) / 100`, so each line is rounded to cents before anything is added up.
2. **Subtotal** (`src/cart.js:9`): the rounded line totals are added together with `reduce`, starting from 0.
3. **Discount** (`src/cart.js:10`): `discounted = subtotal * (1 - discountPct)`. The discount applies only to the goods, not to shipping, and the result is not rounded at this step.
4. **Shipping** (`src/shipping.js:3`): `shippingFor(items)` returns a flat `FLAT_SHIPPING = 5` if the cart has any items, and 0 if it's empty. It depends only on how many lines there are, not on quantity or value.
5. **Final total** (`src/cart.js:11`): `roundCents(discounted + shipping)`, rounded once more to cents.

Example from the tests: `[{2.5×2}, {1×3}]` gives lines of 5 and 3, a subtotal of 8, no discount, plus 5 shipping, for a total of **13**.

## The discount test fails

`npm test` shows 3 tests passing and 1 failing:

```
✖ applies a 10% discount before shipping
  -355 !== 41
```

The code expects `discountPct` as a fraction (0.10 means 10%), but the test passes `discountPct: 10`. That makes the math `40 * (1 - 10) + 5 = -355`. The test expects 41, which is `40 * 0.9 + 5`, so it assumes a whole-number percent. One of the two needs to change: either the code divides by 100, or the test passes `0.1`. Nothing stops a caller from passing a value above 1 either, so a mistake like this can produce a negative total.

One smaller point: the discounted subtotal isn't rounded before shipping is added, so the only rounding after the line totals is the final one. That's fine with flat whole-dollar shipping, but it's worth knowing if shipping ever becomes fractional.

=== turn t1 ===
e5 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e6 [main] run: git log --format='=== %h %an %ad%n%B' -p --stat
e7 [main] REPLY TO USER:
It rounds each line because finance reconciles invoices line by line. Commit `ed84e20` (Dana Reyes, 2026-07-11, "round each line to cents before summing") gives the reason:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

**How the history went:**
- **`56aa9c0`**: the first version rounded once. `lineTotal` returned the raw `price * qty` and `computeTotal` did `roundCents(subtotal)`.
- **`ed84e20`**: moved the rounding into `lineTotal` and removed the rounding on the total, so the total became exactly the sum of the rounded lines. It also added the test `lineTotal({ price: 0.333, qty: 3 }) === 1`. When the total was rounded once, the sum of the unrounded lines could differ by a cent from the sum of the rounded lines finance sees in the ledger export. That's the FIN-212 mismatch.

**What changed after that:** commit `ff910e0` (flat shipping and discounts) added a percentage discount to the subtotal and a final `roundCents` again. With a fractional discount, the total is no longer "the sum of rounded lines." The discount is taken off the whole subtotal without being rounded or split across lines, and then the result is rounded once. So any cart with a discount could bring back the one-cent mismatches FIN-212 fixed, depending on how the ledger records discounts. The commit message doesn't mention this, so I can't tell whether it was intended. It's the same commit that introduced the `discountPct: 10` test that fails.
