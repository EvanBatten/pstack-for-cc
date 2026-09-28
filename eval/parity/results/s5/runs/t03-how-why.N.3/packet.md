=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: git ls-files && wc -l $(git ls-files)
e3 [main] run: for f in README.md package.json src/*.js test/*.js; do echo "== $f"; cat -n $f; done
e4 [main] run: npm test 2>&1 | tail -30
e5 [main] REPLY TO USER:
`/poteto-mode` isn't installed in this session, so I answered your question directly from the code.

## From line items to total

All of it happens in `computeTotal` (`src/cart.js:8`):

1. **Line totals.** Each item becomes `roundCents(item.price * item.qty)` (`src/cart.js:4-6`). `roundCents` is `Math.round(amount * 100) / 100` (`src/money.js:1`). Each line is rounded to cents before anything is added up.
2. **Subtotal.** The rounded line totals are added together with `reduce`, starting at 0 (`src/cart.js:9`).
3. **Discount.** `subtotal * (1 - discountPct)` (`src/cart.js:10`). `discountPct` defaults to `0`. This result is not rounded.
4. **Shipping.** `shippingFor(items)` returns a flat `5` if the cart has any items and `0` if it's empty (`src/shipping.js:3-5`). It depends only on whether there are items, not on quantity or price. It's added after the discount, so the discount never applies to shipping.
5. **Final rounding.** `roundCents(discounted + shipping)` is the returned total (`src/cart.js:11`).

Example from the tests: `[{2.5×2}, {1×3}]` → lines 5 + 3 = 8 → no discount → +5 shipping → **13**.

## The discount is broken

The code treats `discountPct` as a fraction (0.10 means 10%), but the test passes `discountPct: 10`. That gives `40 * (1 - 10) + 5 = -355`, not the expected 41. I ran `npm test`: 3 tests pass and this one fails with `-355 !== 41`. As written, any caller that passes a whole-number percentage gets a negative total. Nothing checks the input, so values above 1 or below 0 go straight through.

The two likely fixes are to divide by 100 in `computeTotal`, or to change the test to pass `0.1`. Which one is right depends on what callers actually send. I haven't changed anything.

=== turn t1 ===
e6 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e7 [main] run: git log --format='%H%n%an <%ae> %ad%n%B---' && git show ed84e20 && git show 56aa9c0 --stat
e8 [main] run: git show ff910e0 -- src/cart.js
e9 [main] REPLY TO USER:
The code rounds each line because of a finance requirement. Commit `ed84e20` ("round each line to cents before summing", Jul 11 2026, Dana Reyes) made the change, and its message explains why:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

Before that commit, the first version (`56aa9c0`) summed the unrounded line amounts and rounded once at the end. Finance's ledger stores each line already rounded, so adding up those lines could differ from the rounded cart total by a cent. Commit `ed84e20` moved `roundCents` into `lineTotal`, removed the rounding of the total, and added the `0.333 × 3 → 1` test.

The latest commit (`ff910e0`) put a final `roundCents` back around `discounted + shipping`. With no discount, that's harmless: it only cleans up floating-point noise in a sum of amounts that are already in cents. With a discount, the goal that "the total is the sum of rounded lines" no longer holds. The discount is applied to the whole subtotal, not to each line, so no set of rounded discounted lines is guaranteed to add up to the invoice total. If Finance reconciles discounted invoices line by line too, the FIN-212 mismatches could come back for those invoices. That's my inference from the code; the history doesn't say how discounted invoices are meant to reconcile.
