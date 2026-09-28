=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: cat <pstack>/poteto-mode/playbooks/investigation.md; cd <repo> && git ls-files
e3 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e4 [main] read <pstack>/unslop/SKILL.md (full, failed)
e5 [main] other tool call
e6 [main] task list create: [todo] Route through the **how** skill. For motivation questions, also route through the **why** skill.
e7 [main] task list create: [todo] Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only investigation`.
e8 [main] task list create: [todo] Produce the `how`-shaped output (Overview / Key Concepts / How It Works / Where Things Live / Gotchas), or a recommendation with a tradeoffs table if the request is a decision between alternatives.
e9 [main] task list create: [todo] Apply the **unslop** skill to the reply.
e10 [main] task list update: [doing] 1
e11 [main] read <pstack>/unslop/SKILL.md (full)
e12 [main] task list update: [done] 1
e13 [main] task list update: [done] 2
e14 [main] task list update: [doing] 3
e15 [main] run: cd <repo> && npm test 2>&1 | tail -40; cat <pstack>/poteto-mode/principles/prove-it-works.md
e16 [main] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e17 [main] says (interim): Reading done and the suite has run. One discount test fails. Checking one rounding edge case, then I'll write up the answer.
e18 [main] run: cd <repo> && node -e 'import("./src/cart.js").then(({lineTotal,computeTotal})=>{console.log(lineTotal({price:1.005,qty:1}), computeTotal([{price:20,qty:2}],{discountPct:0.1}), computeTotal([{price:9.99,qty:1}],{discountPct:0.15}))})'
e19 [main] task list update: [done] 3
e20 [main] task list update: [done] 4
e21 [main] REPLY TO USER:
**Overview.** `computeTotal` in `src/cart.js` does all the work in three steps. It rounds each line to cents and sums the lines. It applies the percentage discount to that subtotal. It adds flat shipping and rounds the result once more. The pricing path is 18 lines across three files. One wrinkle matters. The discount test uses `10` for 10%, the code expects `0.1`, and that test currently fails.

**Key concepts.**
- A line item is `{ price, qty }`. Both are plain JS numbers in dollars. There's no integer-cents type.
- `discountPct` is a fraction. `0.1` means 10%. It defaults to `0`.
- Shipping is a flat `FLAT_SHIPPING = 5` for any cart with at least one item (`src/shipping.js:1-5`).

**How it works.**
1. `lineTotal(item)` computes `roundCents(item.price * item.qty)` (`src/cart.js:4-6`).
2. `computeTotal` sums the rounded lines with `reduce`, starting from `0` (`src/cart.js:9`).
3. It multiplies the subtotal by `(1 - discountPct)` (`src/cart.js:10`). Nothing rounds this value on its own.
4. It adds `shippingFor(items)` and applies `roundCents` to the sum (`src/cart.js:11`). Shipping comes after the discount, so the discount never reduces it.
5. `roundCents` is `Math.round(amount * 100) / 100` (`src/money.js:1`).

For example, `[{2.5 × 2}, {1 × 3}]` gives lines of 5 and 3, a subtotal of 8, and 8 + 5 shipping = 13. The first test asserts this and passes.

**Where things live.**
- `src/cart.js` has `lineTotal` and `computeTotal`, the only entry points.
- `src/money.js` has the one rounding helper.
- `src/shipping.js` has the flat shipping rule.
- `test/cart.test.js` has four tests.

**Gotchas.**
- **The discount unit is wrong in the test (measured).** `npm test` shows 3 passes and 1 failure. `applies a 10% discount before shipping` passes `discountPct: 10`, and the code computes `40 * (1 - 10) + 5 = -355`, so the assertion fails with `-355 !== 41`. Calling it with `discountPct: 0.1` returns `41` (measured). Either the test or the API has the unit wrong. The code has no guard, so any value above 1 produces a negative total. The commit that added discounts (`ff910e0`) left the suite red. That's inferred from the clean tree plus this run.
- **Rounding happens twice.** Each line is rounded before summing, and the total is rounded after the discount. The discounted subtotal is never rounded separately. For a $9.99 item with a 15% discount, the result is `13.49` (measured). That comes from 8.4915 + 5 rounding to 13.49.
- **Float half-cent cases round down.** `lineTotal({ price: 1.005, qty: 1 })` returns `1`, not `1.01` (measured). That happens because `1.005 * 100` is just under 100.5 in floating point. Anyone expecting half-up rounding on cent boundaries gets a lower price.
- **Shipping counts line entries, not quantity.** A line with `qty: 0` still counts toward `items.length > 0`, so a cart containing only that line costs $5 (inferred from `src/shipping.js:4`, not run).

**Principles applied.** Prove It Works decided whether the discount path was correct. I ran the suite and called the functions directly instead of trusting the test file, and that run found the failing discount test.

**Steps.**
1. I used the how skill's simple path directly without an explainer subagent, because the code was already fully read in the main thread.
2. `throughput checkpoint: n/a, read-only investigation`.
3. Done, above.
4. I wrote the reply to the unslop rules.

=== turn t1 ===
e22 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e23 [main] task list create: [todo] Route through the **how** skill. For motivation questions, also route through the **why** skill.
e24 [main] task list create: [todo] Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only investigation`.
e25 [main] task list create: [todo] Produce the `how`-shaped output (Overview / Key Concepts / How It Works / Where Things Live / Gotchas), or a recommendation with a tradeoffs table if the request is a decision between alternatives.
e26 [main] task list create: [todo] Apply the **unslop** skill to the reply.
e27 [main] task list update: [doing] 5
e28 [main] run: cat <pstack>/why/SKILL.md; cd <repo> && git log --stat --format='=== %H%nAuthor: %an <%ae>%nDate: %ad%n%n%B' && git log -p --format='=== %h %s' && git branch -a && git tag && git stash list && git notes list 2>/dev/null
e29 [main] read <pstack>/why/SKILL.md (full)
e30 [main] run: cd <repo> && git remote -v; node -e 'import("./src/cart.js").then(({lineTotal,computeTotal})=>{const r=x=>Math.round(x*100)/100;let n=0,ex;for(let a=1;a<=300;a++)for(let b=1;b<=300;b++){const items=[{price:a/100,qty:1},{price:b/100,qty:1}];const tot=computeTotal(items,{discountPct:0.15});const perLine=r(items.reduce((s,i)=>s+r(lineTotal(i)*0.85),0)+5);if(tot!==perLine){n++;ex??=[a/100,b/100,tot,pe [...59 more chars]
e31 [main] task list update: [done] 5
e32 [main] task list update: [done] 6
e33 [main] task list update: [done] 7
e34 [main] task list update: [done] 8
e35 [main] REPLY TO USER:
Finance reconciles invoices line by line. The commit that added per-line rounding says so in its message. The discount commit that came after it broke that rule for discounted carts.

**What the history says.** The first version (`56aa9c0`, 2026-06-10) did it the other way. `lineTotal` returned the raw `price * qty`, and `computeTotal` rounded the total once. A month later, `ed84e20` (2026-07-11, Dana Reyes) switched to rounding each line. Its message reads:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

So the rule is that the total must equal the sum of the rounded lines, because that is what the ledger export adds up. Rounding the total once lets the unrounded fractions add up to a stray cent. The 2% figure and ticket FIN-212 come from that message. I couldn't check the ticket itself.

**The discount commit breaks the rule.** `ff910e0` (2026-08-12) applies `discountPct` to the whole subtotal and rounds once at the end (`src/cart.js:10-11`). Once a discount applies, the total is no longer a sum of rounded lines. That is the same pattern `ed84e20` removed. I measured it on every two-line cart with prices from $0.01 to $3.00 at a 15% discount. In 22,523 of 90,000 carts (25%), the total differs from discounting and rounding each line and then summing. The first example is $0.01 + $0.03, which totals 5.03, while the per-line sum is 5.04. That comparison assumes Finance would expect the discount spread across the lines. That's a guess, because nothing in the repo says how discounts appear on an invoice.

The `ff910e0` message is one line and doesn't mention rounding. I infer the change was an oversight rather than a decision to drop the FIN-212 rule. That is inference, not something the history records.

**What I couldn't check.**
- The FIN-212 ticket. No issue tracker is connected in this session.
- Any chat or design-doc discussion. The connected Gmail and Drive belong to a personal account, not the repo author's shop.example identity, so I didn't search them.
- PR threads. The repo has no remote, so there are none to read.

**If you change this code.**
- Preserve the total as the sum of rounded lines. That is the FIN-212 rule.
- Change the discount step so it discounts each line and rounds it, or so it posts the discount as its own rounded line. Which one depends on how Finance's ledger records discounts, and that call needs Finance.
- Avoid going back to rounding once at the end.
- The discount test already fails on the unit mix-up from my last reply. A fix should repair that test and add one for the per-line rule.

**Principles.** Prove It Works decided how far to trust the history. The `ed84e20` message states the rule, but I didn't assume the current code still follows it. I measured that it doesn't for discounted carts.

**Steps.**
1. I followed the why skill inline and did not fan out investigators. The commit message states the full rationale, no connected source could look up FIN-212, and there are no PRs.
2. `throughput checkpoint: n/a, read-only investigation`.
3. Done, written as a why answer because this is a motivation question.
4. I wrote the reply to the unslop rules.
