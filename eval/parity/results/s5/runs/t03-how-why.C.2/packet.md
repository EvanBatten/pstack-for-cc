=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] says (interim): `/poteto-mode` isn't a skill I have available, so I'll just answer the question by reading the cart code.
e3 [main] run: git ls-files | head -100
e4 [main] read <repo>/src/cart.js (full)
e5 [main] read <repo>/src/money.js (full)
e6 [main] read <repo>/src/shipping.js (full)
e7 [main] REPLY TO USER:
The total is built in `computeTotal` in `src/cart.js` in four steps: price each line, add the lines up, apply the discount, then add shipping and round.

```8:12:src/cart.js
export function computeTotal(items, { discountPct = 0 } = {}) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discounted = subtotal * (1 - discountPct);
  return roundCents(discounted + shippingFor(items));
}
```

1. **Line totals.** `lineTotal(item)` multiplies `item.price * item.qty` and rounds the result to cents with `roundCents` from `src/money.js`, which is `Math.round(amount * 100) / 100`.
2. **Subtotal.** The rounded line totals are added together with `reduce`, starting from 0.
3. **Discount.** The subtotal is multiplied by `(1 - discountPct)`. `discountPct` is a fraction, so `0.1` means 10% off, and it defaults to 0. This intermediate value is not rounded.
4. **Shipping and final rounding.** `shippingFor(items)` in `src/shipping.js` adds a flat `5` if the cart has any line items, or `0` if it's empty. That sum is rounded to cents once more and returned.

A few behaviours that follow from this code:

- **The discount doesn't apply to shipping.** It's taken off before shipping is added.
- **Shipping depends on whether the cart has items, not on how many.** One item with `qty: 100` costs the same $5 as ten different items.
- **An empty cart totals `0`.**
- **All the maths uses floating-point dollars, not integer cents.** `Math.round(x * 100) / 100` can round some half-cent values the wrong way. For example, `1.005` becomes `1` instead of `1.01`, because `1.005 * 100` is actually slightly less than 100.5.
- **Nothing checks the discount.** A `discountPct` above 1 gives a negative subtotal, and a negative value adds a surcharge.

=== turn t1 ===
e8 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e9 [main] run: git log --stat --format="---%n%H %an %ad%n%s%n%b" --date=short && git log -p --follow -- src/cart.js
e10 [main] read <repo>/test/cart.test.js (full)
e11 [main] run: node --test 2>&1 | tail -30
e12 [main] REPLY TO USER:
Each line is rounded so the cart matches Finance's records. Commit `ed84e20` (Dana Reyes, 2026-07-11) made that change on purpose, and its message explains why:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

The history goes like this:

1. **`56aa9c0`, 2026-06-10.** The first version kept line totals unrounded and rounded the total once.
2. **`ed84e20`, 2026-07-11.** Rounding moved into `lineTotal`, and the final rounding was removed. The total became exactly the sum of the rounded lines, so it matches what Finance gets when they add up the lines themselves. The test `"rounds each line to cents"` was added in this commit.
3. **`ff910e0`, 2026-08-12.** Shipping and discounts were added, and a final `roundCents` was brought back. It's needed there because multiplying by `(1 - discountPct)` can produce fractions of a cent.

So you shouldn't switch to rounding the total once. That would bring back the FIN-212 mismatches.

There's a catch for discounted carts. The discount is applied to the whole subtotal, not to each line, so a discounted invoice is no longer simply the sum of its rounded lines. From the code alone, it's possible the one-cent mismatches still happen on discounted orders. The history doesn't say how Finance handles discounts, so this is worth asking them.

I also need to correct part of my last answer. I said `discountPct` is a fraction, meaning `0.1` is 10%. That's what the code does, but the test treats it as a whole percent. The test `"applies a 10% discount before shipping"` passes `discountPct: 10` and expects `41`. I ran the tests and that one fails: it gets `-355`, because 40 × (1 − 10) + 5 = −355. Either the code or the test is wrong, and it was already broken when `ff910e0` added both. The other three tests pass.
