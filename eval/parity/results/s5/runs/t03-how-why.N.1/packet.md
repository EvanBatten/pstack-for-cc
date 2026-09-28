=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: git ls-files && git ls-files | grep -v -E '\.(lock|png)$' | xargs wc -l
e3 [main] run: for f in README.md package.json src/*.js test/*.js; do echo "=== $f"; cat -n $f; done
e4 [main] run: npm test 2>&1 | tail -30
e5 [main] REPLY TO USER:
The `/poteto-mode` command isn't installed in this session, so I answered your question directly. The whole pipeline is in `src/cart.js:8-12`, which calls two small helpers.

## From line items to total

`computeTotal(items, { discountPct = 0 })` runs four steps:

1. **Price each line.** `lineTotal(item)` (`src/cart.js:4`) returns `roundCents(item.price * item.qty)`, so each line is rounded to cents on its own.
2. **Add up the subtotal** (`src/cart.js:9`). It sums the rounded line totals with `reduce`, starting at 0.
3. **Apply the discount** (`src/cart.js:10`). `subtotal * (1 - discountPct)`. The result isn't rounded at this step.
4. **Add shipping and round** (`src/cart.js:11`). `shippingFor(items)` (`src/shipping.js:3`) charges a flat `FLAT_SHIPPING = 5` if the cart has any items and 0 if it's empty. The discount never touches shipping. The sum goes through `roundCents` once more.

`roundCents` (`src/money.js:1`) is `Math.round(amount * 100) / 100`.

So the formula is: **total = round(Σ round(price × qty) × (1 − discountPct) + shipping)**.

## One of the tests fails

I ran `npm test`: 3 pass and 1 fails. The code and one test disagree about what `discountPct` means:

- The code treats it as a **fraction**, so `0.1` means 10%.
- The test "applies a 10% discount before shipping" (`test/cart.test.js:14`) passes `discountPct: 10` and expects `41`. The code computes `40 × (1 − 10) + 5 = -355`.

```
✖ applies a 10% discount before shipping
  -355 !== 41
```

Either the test should pass `0.1`, or the code should divide by 100. Which one is right depends on what callers send, and nothing in this repo shows that. Also, nothing stops a discount from pushing the total below zero, which is how you get −355.

Two smaller points:
- An empty cart totals `0`, because shipping is only charged when there are items.
- Line totals are rounded and so is the final total, but the discounted subtotal isn't. The last `roundCents` cleans up any fractional cents the discount creates.

=== turn t1 ===
e6 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e7 [main] run: git log -p --format='=== %h %an <%ae> %ad%n%B' --reverse
e8 [main] REPLY TO USER:
Finance reconciles invoices line by line, and rounding only the total made the cents disagree. Commit `ed84e20` ("round each line to cents before summing", Dana Reyes, 2026-07-11) made the change and gives this reason:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

**Before that commit** (`56aa9c0`): `lineTotal` returned the raw `price * qty`, and `computeTotal` rounded the sum once. The unrounded line amounts could add up to a total one cent off from the sum of the rounded lines on the invoice.

**What changed:** `lineTotal` now calls `roundCents`, and `computeTotal` became a plain sum of those rounded lines, with no final rounding. That commit added the `lineTotal({ price: 0.333, qty: 3 }) === 1` test to lock this in.

**What happened next** (`ff910e0`, 2026-08-12): the shipping-and-discount commit put a `roundCents` back around the total. Its message has no body explaining why. The likely reason is that multiplying by `(1 - discountPct)` can create fractional cents.

This last commit may undercut the FIN-212 fix; this is my own reading, not something the history says. The discount is applied to the whole subtotal, not to each line, and the discounted total is then rounded. With a discount, the total is no longer the sum of rounded line amounts, which was the property Finance needed. If the invoice shows discounted line amounts, one-cent mismatches could come back on discounted orders. Whether that matters depends on how Finance handles discounts in the ledger export, which the repo doesn't show. FIN-212 or Dana would be the place to check.
