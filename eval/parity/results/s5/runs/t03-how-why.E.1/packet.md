=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: git ls-files && cat "<pstack>/poteto-mode/playbooks/investigation.md"
e3 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e4 [main] run: for f in src/*.js test/cart.test.js package.json README.md; do echo "=== $f"; cat -n "$f"; done
e5 [main] run: npm test 2>&1 | tail -40; node -e 'import("./src/cart.js").then(m=>{console.log(m.computeTotal([{price:20,qty:2}],{discountPct:10}), m.computeTotal([{price:20,qty:2}],{discountPct:0.1}), m.computeTotal([{price:0.1,qty:1},{price:0.2,qty:1}]))})'
e6 [main] REPLY TO USER:
The total comes out of one function, `computeTotal` in `src/cart.js:8`. It takes the item array and an optional `{ discountPct }` and runs four steps. I ran the suite and some probes to confirm how it behaves, and one test fails because the discount's unit doesn't match between the code and the test.

**The data.** Each line item is a plain `{ price, qty }` object. There is no ID, no currency and no type checking. Money is a JavaScript float in dollars, not whole cents.

**How it works.**

1. **Line totals.** `lineTotal` (`src/cart.js:4`) multiplies `price * qty` and rounds the result to cents with `roundCents` (`src/money.js:1`, `Math.round(x * 100) / 100`). Each line is rounded on its own before anything is added up (commit `ed84e20`).
2. **Subtotal.** `computeTotal` adds up the rounded line totals with `reduce` (`src/cart.js:9`).
3. **Discount.** The subtotal is multiplied by `(1 - discountPct)` (`src/cart.js:10`). This result is not rounded, and the discount comes off before shipping is added.
4. **Shipping and the final round.** `shippingFor` (`src/shipping.js:3`) adds a flat $5 (`FLAT_SHIPPING`) if the cart has any items and $0 if it's empty. The number of items and their price don't change it. The sum is rounded to cents once more and returned (`src/cart.js:11`).

So the total is `round(sum(round(price × qty)) × (1 − discountPct) + shipping)`.

**Where things live.** `cart.js` does the arithmetic. `money.js` holds the one rounding helper. `shipping.js` holds the flat fee. The README describes the same split.

**Gotchas.**

- **The discount unit is inconsistent, and the suite is red because of it.** The code reads `discountPct` as a fraction, so 0.1 means 10%. `test/cart.test.js:14` passes `10` and expects `41`. I ran `npm test` and got 3 passing and 1 failing, with `-355 !== 41`. Calling it with `discountPct: 0.1` returns `41` (measured). Nothing in the code limits the value, so passing a percentage produces a negative total. Commit `ff910e0` added both the code and the test, so the mismatch shipped as part of the feature.
- **Totals can be off by a cent.** Lines are rounded before summing, but the sum and the discounted amount are not rounded. The final `roundCents` then rounds a float that may carry binary error. Two items at $0.10 and $0.20 total `5.3` (measured). That one comes out right, but amounts that land exactly on a half-cent after a discount could round the wrong way. That's a guess, and I didn't find a case that shows it.
- **No input checks.** Negative `qty`, a missing `price` or a discount above 1 all go straight into the math.

Nothing was changed, since this was a read-only question. Fixing the discount means choosing which contract is correct. I'd read `discountPct` as a percentage, because that's what the name and the test say, and divide by 100 in `computeTotal`. I can make that change as a bug fix if you'd like.

This was a small read-only question over three short files, so I read them directly and loaded none of the principle skills. No principle shaped a decision here.

=== turn t1 ===
e7 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e8 [main] run: git log --format='--- %h %an %ad%n%B' --date=short && git show ed84e20 56aa9c0 --stat -p | head -120
e9 [main] run: git show ff910e0 -- src/cart.js
e10 [main] REPLY TO USER:
It rounds each line because of how Finance reconciles invoices. Commit `ed84e20` (Dana Reyes, 2026-07-11) says so in its message:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

**What changed.** The first commit, `56aa9c0` (2026-06-10), rounded only the total. `lineTotal` returned the raw `price * qty` and `computeTotal` rounded the sum once. `ed84e20` moved the rounding into `lineTotal`, removed the final round, and added the `0.333 × 3 → 1` test. A ledger that stores each line to the cent adds up rounded lines. Code that rounds only the total can therefore come out a cent different, and that's the mismatch FIN-212 describes. I couldn't open FIN-212 because no issue tracker is connected here. What I know about it comes from the commit message.

**What the latest commit did to that rule.** `ff910e0` (2026-08-12) added discounts and shipping and put a final `roundCents` back on the total. Without a discount this makes no difference. The lines are already in cents, so the final round only removes float noise. With a discount, it no longer holds. The discount comes off the whole subtotal, and the only rounding happens after shipping is added. The discount never gets rounded per line, so the total is no longer the sum of rounded lines that `ed84e20` promised. My read is that discounted invoices can show the same one-cent mismatches FIN-212 reported. That's inferred from the code and the commit message. I haven't reproduced it against a ledger. The `ff910e0` message has no body, so the history doesn't say whether this was deliberate.

This affects the discount fix I suggested earlier. If Finance still reconciles line by line, fixing the unit is not enough. The discount has to come off each line with the same rounding, or it has to appear on the invoice as its own rounded line. That's a question for Finance, not something the code can decide. You would need to check whether FIN-212's line-by-line rule also covers discounted orders.
