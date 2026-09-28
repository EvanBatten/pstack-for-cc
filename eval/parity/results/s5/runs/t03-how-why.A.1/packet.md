=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] says (interim): I'll follow the Investigation playbook and read the cart code.
e3 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e4 [main] run: git ls-files
e5 [main] read <repo>/src/cart.js (full)
e6 [main] read <repo>/src/money.js (full)
e7 [main] read <repo>/src/shipping.js (full)
e8 [main] read <repo>/test/cart.test.js (full)
e9 [main] other tool call
e10 [main] says (interim): The discount test looks inconsistent with the code, so I'll run the tests and check the README.
e11 [main] run: node --test 2>&1 | tail -40; cat README.md package.json
e12 [main] REPLY TO USER:
`computeTotal` gets there in four steps. It rounds each line to cents, sums the lines, applies the discount to that subtotal, adds flat shipping, then rounds once more. There is one live bug. The discount option is treated as a fraction (`0.1`), but the test passes a percentage (`10`). That test fails right now: `node --test` gives 3 passing and 1 failing, with `-355 !== 41`.

**How it works.**

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

1. **Line totals.** `lineTotal` multiplies `price * qty` and rounds to cents. So `{ price: 0.333, qty: 3 }` becomes `1`, not `0.999`.
2. **Subtotal.** A `reduce` adds up the rounded line totals. Rounding happens per line, not on the sum.
3. **Discount.** The subtotal is multiplied by `(1 - discountPct)`. The discount applies to merchandise only and never to shipping.
4. **Shipping.** `shippingFor` in `src/shipping.js` returns `FLAT_SHIPPING = 5` when the cart has any items and `0` when it is empty. It ignores quantity, weight and price.
5. **Final round.** `roundCents(discounted + shipping)` in `src/money.js` computes `Math.round(amount * 100) / 100`. This last round cleans up any fractional cents the discount introduced.

For example, `[{2.5 × 2}, {1 × 3}]` gives lines of 5 and 3, a subtotal of 8, plus 5 shipping, for a total of 13. That matches the first test.

**Where things live.** `src/cart.js` does the arithmetic. `src/money.js` holds the single rounding helper. `src/shipping.js` holds the shipping rule.

**Gotchas.**

- **Discount units don't agree.** The name `discountPct` and the test (`discountPct: 10`, expecting 41) both mean a percentage. The code does `1 - discountPct`, which only works for a fraction. With `10` it computes `40 × -9 + 5 = -355`. A caller who passes `10` gets a negative total, and nothing rejects values outside the valid range. Either the code should divide by 100 or the option should be renamed and the test changed. That's a product call about the API, so I haven't changed anything.
- **Rounding can drift by a cent.** Because lines are rounded before summing, the result can differ from rounding the raw sum once. That's a common and defensible choice, but it's a choice.
- **Floating point.** Money is stored as JS floats, not integer cents. `roundCents` hides most of the error, but `Math.round` on values like `x.xx5` can round the wrong way because of how binary floats represent them. This is inferred from the code; I didn't find a case that breaks here.

**Principles.** Prove It Works shaped this answer. I ran the suite instead of assuming the tests pass, and that's how the discount bug showed up as a measured failure rather than a guess. I haven't read that principle's own file this session, so this is a loose citation. The playbook says to route through a `how` skill, but it isn't in the skill tree, so I used the playbook's output shape directly.

Want me to fix the discount units? Say which meaning you want, a percentage or a fraction.

=== turn t1 ===
e13 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e14 [main] run: git log --stat --format="--- %h %an %ad%n%s%n%b" --date=short; echo ===; git log -p --follow -- src/cart.js
e15 [main] REPLY TO USER:
Line rounding was a deliberate fix for a finance reconciliation problem. The original code rounded the total once, and the history shows it was changed on purpose.

**History.**

1. `56aa9c0` (2026-06-10) started the module the way you describe. `lineTotal` returned the raw `price * qty`, and `computeTotal` called `roundCents` once on the sum.
2. `ed84e20` (2026-07-11), by Dana Reyes, moved rounding into `lineTotal` and dropped the round on the total. The commit message explains why:

   > Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

   So the rule is that the total must equal the sum of the lines as printed. Rounding only the total breaks that rule whenever the fractional cents on different lines add up past a half cent.
3. `ff910e0` (2026-08-12) added shipping and the discount. It also brought back a final `roundCents` on the total, which is needed because multiplying by `(1 - discountPct)` can produce fractional cents again.

**What this means now.** Without a discount, the final round does nothing, and the total still equals the rounded lines plus shipping. With a discount, the total is scaled from the rounded subtotal. It will only reconcile line by line if the invoice shows the discount as its own rounded line. This is an inference from the code: I didn't find any invoice-rendering code in this repo to check it against, and FIN-212 is a ticket reference I can't open from here.

The discount units bug from earlier also comes from `ff910e0`. That commit added both the `1 - discountPct` math and the test that passes `10`, so the author seems to have meant a percentage. That's a guess from the name and the test, not something the commit message says.
