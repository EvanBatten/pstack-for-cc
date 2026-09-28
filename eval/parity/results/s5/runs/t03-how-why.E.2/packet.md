=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: cat "<pstack>/poteto-mode/playbooks/investigation.md"; cd <repo> && git ls-files
e3 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e4 [main] run: cd <repo> && for f in README.md package.json src/*.js test/cart.test.js; do echo "=== $f"; cat -n "$f"; done
e5 [main] run: cd <repo> && npm test 2>&1 | tail -30; git log --stat --format='%h %s' | head -30
e6 [main] run: cd <repo> && node --input-type=module -e 'import {roundCents} from "./src/money.js"; import {computeTotal} from "./src/cart.js"; console.log(roundCents(1.005), computeTotal([{price:20,qty:2}],{discountPct:0.1}), computeTotal([{price:1,qty:0}]))'
e7 [main] REPLY TO USER:
The total comes out of one function, `computeTotal` in `src/cart.js:8`. It goes through four steps, and I checked each one against the running code. Separately, the discount test fails right now (`npm test` reports 3 passing and 1 failing). That is because the code and the test expect the discount in different formats.

**Inputs.** A cart is an array of items shaped `{ price, qty }`. Prices are plain JavaScript numbers in dollars, not integer cents. The only option is `discountPct`, which defaults to 0.

**How the total is built:**

1. **Line totals.** `lineTotal` (`src/cart.js:4`) multiplies `price * qty` and rounds the result to cents with `roundCents` (`src/money.js:1`, which is `Math.round(amount * 100) / 100`). Commit `ed84e20` added rounding each line before summing. For example, `{ price: 0.333, qty: 3 }` comes to exactly `1`.
2. **Subtotal.** `computeTotal` adds up the rounded line totals, starting from 0 (`src/cart.js:9`).
3. **Discount.** The whole subtotal is multiplied by `(1 - discountPct)` (`src/cart.js:10`). The discount therefore applies before shipping, and the discounted amount is not rounded at this step.
4. **Shipping and final rounding.** `shippingFor(items)` (`src/shipping.js:3`) adds a flat `5` when the cart has at least one item and `0` when it is empty. The sum is rounded to cents once more (`src/cart.js:11`), and that is the value returned.

Worked example from the first test: 2.5×2 = 5.00, plus 1×3 = 3.00, gives a subtotal of 8.00. With no discount and 5 for shipping, the total is 13. The test passes.

**Things to watch out for:**

- **Discount format mismatch.** The code expects a fraction, so `0.1` means 10%. The test at `test/cart.test.js:14` passes `10`. That makes the code compute 40 × (1 − 10) + 5 = **−355** where the test expects 41. I ran both: `discountPct: 0.1` gives `41`, and the test run reports `-355 !== 41`. Both came in with `ff910e0`, so that commit never passed its own test. Nothing in the code rejects a discount above 1, so a caller that thinks in percent gets a negative total with no error. Someone has to choose between fraction and percent before either the code or the test is changed.
- **Shipping counts line items, not quantity.** A cart holding one item with `qty: 0` still gets charged shipping. I measured `computeTotal([{ price: 1, qty: 0 }])` returning `5`.
- **Floating-point rounding.** Because prices are floats, `roundCents` can round a half cent down. I measured `roundCents(1.005)` returning `1`, not `1.01`. Existing prices don't hit this yet. Any price with three decimal places could.

I made no changes; this was a read-only look. You'll need to decide which discount format is correct before anyone fixes the failing test.

=== turn t1 ===
e8 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e9 [main] run: cd <repo> && git log --format='%h %an %ad%n%B' -p ed84e20 -1; git show 56aa9c0 -- src/cart.js test/cart.test.js; git log --all --oneline; git notes list 2>/dev/null; git tag
e10 [main] run: cd <repo> && git show ff910e0 --format='%h %ad%n%B' -- src/cart.js
e11 [main] REPLY TO USER:
Each line is rounded first because Finance reconciles invoices line by line against the ledger export. Rounding only the total left invoices a cent off from those rows. The reason is written in commit `ed84e20` (Dana Reyes, 2026-07-11). Its message says "rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines."

**The original design did round once.** In the first commit, `56aa9c0`, `lineTotal` returned the raw `price * qty` and `computeTotal` rounded the summed subtotal a single time. Commit `ed84e20` moved `roundCents` into `lineTotal`. It removed rounding from the total entirely, since a sum of whole cents needs none. It also added the `0.333 × 3 → 1` test to pin the per-line behavior. I only have FIN-212 as a reference in that commit message. I found no tracker link or notes in the repo, so the 2% figure is the commit author's claim and I haven't checked it.

**The discount commit weakens that rule.** Commit `ff910e0` (2026-08-12) has no commit message. It applies `discountPct` to the whole subtotal and rounds the result again at the total. Once a discount is applied, the total is no longer the sum of the rounded lines. That can bring back the one-cent drift FIN-212 was about, unless the ledger records the discount as a separate line. That last part is my inference from the code; I haven't reproduced it against a real ledger export. Whoever fixes the discount format should also decide whether the discount belongs on each line or as its own ledger line.
