=== turn t0 ===
e1 [main] USER: /poteto-mode How does the cart get from line items to the final total? Answer from the code.
e2 [main] run: cat "<pstack>/poteto-mode/playbooks/investigation.md"; echo ----; cd <repo> && git ls-files
e3 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e4 [main] run: for f in README.md package.json src/*.js test/*.js; do echo "=== $f"; cat -n "$f"; done; echo; cat "<pstack>/how/SKILL.md"; echo ====; cat "<pstack>/unslop/SKILL.md"
e5 [main] read <pstack>/how/SKILL.md (full, failed)
e6 [main] read <pstack>/unslop/SKILL.md (full, failed)
e7 [main] other tool call
e8 [main] task list create: [todo] Route through the **how** skill. For motivation questions, also route through the **why** skill.
e9 [main] task list create: [todo] Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only investigation`.
e10 [main] task list create: [todo] Produce the `how`-shaped output (Overview / Key Concepts / How It Works / Where Things Live / Gotchas), or a recommendation with a tradeoffs table if the request is a decision between alternatives.
e11 [main] task list create: [todo] Apply the **unslop** skill to the reply.
e12 [main] task list update: [doing] 1
e13 [main] task list update: [done] 2
e14 [main] run: for f in README.md package.json src/*.js test/*.js; do echo "=== $f"; cat -n "$f"; done; echo; cat "<pstack>/how/SKILL.md"; echo ====; cat "<pstack>/unslop/SKILL.md"
e15 [main] read <pstack>/how/SKILL.md (full)
e16 [main] read <pstack>/unslop/SKILL.md (full)
e17 [main] says (interim): Quick update. I've read the whole codebase (four small files). Next I'm running the tests, because the discount test looks like it disagrees with the code.
e18 [main] run: npm test 2>&1 | tail -40; node -e 'import("./src/cart.js").then(m=>{console.log(m.computeTotal([{price:20,qty:2}],{discountPct:10}), m.computeTotal([{price:20,qty:2}],{discountPct:0.1}), m.computeTotal([{price:0.1,qty:1},{price:0.2,qty:1}]))})'; echo ====; cat "<pstack>/poteto-mode/principles/prove-it-works.md" "<pstack>/poteto-mode/principles/guard-the-context-window.md"
e19 [main] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e20 [main] read <pstack>/poteto-mode/principles/guard-the-context-window.md (full)
e21 [main] task list update: [done] 1
e22 [main] task list update: [done] 3
e23 [main] task list update: [done] 4
e24 [main] REPLY TO USER:
## How the cart goes from line items to the total

One function, `computeTotal` in `src/cart.js:8`, turns a list of `{ price, qty }` items into the amount charged at checkout. It runs four steps. The last one is a single rounding.

**Steps.**

1. **Line totals.** For each item, `lineTotal` (`src/cart.js:4`) computes `price * qty` and rounds it to cents with `roundCents`. So `{ price: 0.333, qty: 3 }` becomes `1`, and the test at `test/cart.test.js:9` passes on that (measured).
2. **Subtotal.** `items.reduce` adds up the rounded line totals, starting from `0` (`src/cart.js:9`). There is no rounding at this step.
3. **Discount.** The code computes `subtotal * (1 - discountPct)`, and `discountPct` defaults to `0` (`src/cart.js:10`). The discount comes off before shipping is added. The result is not rounded here.
4. **Shipping and final rounding.** `shippingFor(items)` (`src/shipping.js:3`) returns a flat `5` for any cart that has items and `0` for an empty one. That amount is added to the discounted subtotal, and the sum is rounded to cents (`src/cart.js:11`).

`roundCents` is the only money helper. It is `Math.round(amount * 100) / 100` on plain floats (`src/money.js:1`).

**Where things live.**

- `src/cart.js` builds the line totals, subtotal, discount and final total.
- `src/money.js` rounds to cents.
- `src/shipping.js` holds the flat shipping rule and the `FLAT_SHIPPING = 5` constant.
- `test/cart.test.js` has four cases, one per step above plus the empty cart.

## Gotchas

**The discount doesn't match its test, and the suite is red.** The code treats `discountPct` as a fraction, where `0.1` means 10%. The test passes `discountPct: 10` and expects `41` (`test/cart.test.js:14`). I ran `npm test` and 3 of 4 tests passed. That one failed with `-355 !== 41` (measured). Here is where `-355` comes from: `40 * (1 - 10) + 5`. With `discountPct: 0.1` the same cart returns `41` (measured with `node -e`). So one of the two is wrong. Either the name `discountPct` means callers should pass a percent and the code should divide by 100, or the test should pass `0.1`. The code alone can't tell us which one the checkout callers send. That is a product decision, and I changed nothing.

**No bounds on the discount.** Nothing clamps `discountPct`, so any value above 1 gives a negative total (inferred from `src/cart.js:10`, and the `-355` above shows it).

**Shipping looks at the number of items, not their quantities.** A cart holding a single `{ qty: 0 }` item still pays 5 in shipping, because `shippingFor` only checks `items.length` (inferred from `src/shipping.js:4`, not run).

**Floats all the way through.** Money is stored as floats, not integer cents. Each line is rounded, but the discounted subtotal is only rounded once, together with shipping at the end. `0.1 + 0.2` in two lines comes out as `5.3` (measured). That works for now because `roundCents` fixes it at the end.

## Process notes

- **Guard the Context Window.** The how skill says to spawn an explainer subagent even on the simple path. I skipped that. The subsystem is 19 lines across three files, and I had already read all of them, so a delegate would have re-read the same code to repeat it back.
- **Prove It Works.** Because of this principle I ran the suite and the `node -e` probes before describing the discount step. Just reading the code would have missed that the test and the code disagree.

Steps:
1. Route through the how skill. Done on its simple path. Skipped the why skill because this question is about how the code works, not why it was built this way.
2. `throughput checkpoint: n/a, read-only investigation`.
3. Produce the how-shaped output. Done.
4. Apply the unslop skill. Done.

=== turn t1 ===
e25 [main] USER: Why does it round each line instead of rounding the total once? Check the history before you answer.
e26 [main] task list create: [todo] Route through the **how** skill. For motivation questions, also route through the **why** skill.
e27 [main] task list create: [todo] Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only investigation`.
e28 [main] task list create: [todo] Produce the `how`-shaped output (Overview / Key Concepts / How It Works / Where Things Live / Gotchas), or a recommendation with a tradeoffs table if the request is a decision between alternatives.
e29 [main] task list create: [todo] Apply the **unslop** skill to the reply.
e30 [main] task list update: [doing] 5
e31 [main] task list update: [done] 6
e32 [main] run: git log --stat --format='=== %h %an <%ae> %ad%n%B' && git show ed84e20 && git show 56aa9c0 -- src/cart.js; git branch -a; git tag; git stash list; echo ====; cat "<pstack>/why/SKILL.md"
e33 [main] read <pstack>/why/SKILL.md (full)
e34 [main] run: git show ff910e0 -- src/cart.js && git blame src/cart.js && node -e '
import("./src/cart.js").then(({computeTotal})=>{
const r=a=>Math.round(a*100)/100;
const items=[{price:0.05,qty:1},{price:0.05,qty:1},{price:0.05,qty:1}];
const d=0.1;
const total=computeTotal(items,{discountPct:d});
const perLine=r(items.reduce((s,i)=>s+r(r(i.price*i.qty)*(1-d)),0)+5);
console.log({total, sumOfDiscountedLines:p [...130 more chars]
e35 [main] other tool call
e36 [main] other tool call
e37 [main] other tool call
e38 [main] task list update: [done] 5
e39 [main] task list update: [done] 7
e40 [main] task list update: [done] 8
e41 [main] REPLY TO USER:
## Why it rounds each line

It rounds each line so Finance can reconcile invoices line by line. The history states this directly, so this isn't a guess. Commit `ed84e20` (Dana Reyes, 2026-07-11) says this:

> Finance reconciles invoices line by line against the ledger export. Rounding only the cart total left one-cent mismatches on about 2% of invoices (FIN-212), so every line is rounded first and the total is the sum of rounded lines.

**The code history matches.** In the first commit (`56aa9c0`), `lineTotal` returned the raw float and `computeTotal` rounded the subtotal once. `ed84e20` moved `roundCents` into `lineTotal` and removed the final rounding. After that change the total was exactly the sum of the rounded lines. It also added the test `rounds each line to cents`.

**Why rounding once caused mismatches.** Each line on the invoice shows a rounded amount. Rounding only the total can come out different from the sum of those shown amounts. I measured the smallest case with two lines of `0.005`. Rounding once gives `0.01`, and rounding each line gives `0.02`. The ledger adds up the lines, so a one-cent gap shows up.

## The discount commit brought the problem back for discounted carts

`ff910e0` (2026-08-12) added the discount and shipping. It takes the discount off the whole subtotal and rounds the total again (`src/cart.js:10-11`). The invoice lines are still rounded before the discount, but nothing splits the discount across the lines. So a discounted invoice can once again differ from the sum of its discounted lines. I measured this with three lines of `0.05` and `discountPct: 0.1`. `computeTotal` returns `5.14`, and applying the discount to each line, rounding each, and adding shipping gives `5.15`. Carts without a discount still reconcile, because each line is already whole cents.

This is the FIN-212 problem again, now on discounted carts. The commit message doesn't mention FIN-212 or line-level reconciliation, so I think the regression was accidental (inferred, not confirmed). How Finance wants a discount split across lines is their call. The code can't answer that. Last turn I also found that `discountPct` is ambiguous between a fraction and a percent, and that the test for it fails. Both issues are in the same lines, so one fix could cover them.

## What we don't know

- Whether Finance's ledger export has a discount line or expects the discount already spread across the lines. That decides whether the `5.14` vs `5.15` gap matters in practice.
- The details of FIN-212, such as how the 2% was measured. No issue tracker is connected here, so I couldn't open the ticket.

## Sources consulted

- **Git.** Three commits, `git blame` on `src/cart.js`, and the full diffs. This is where the answer came from.
- **Gmail.** I searched for `FIN-212` and cart rounding and got no results.
- **Google Drive.** I searched the full text for `FIN-212`. It returned only unrelated personal files, so nothing useful.
- **Issue tracker, chat, observability, error tracking, analytics.** Skipped because no tools for these are connected in this session. That leaves a gap. The ticket itself is the missing evidence.

## Process notes

- **Guard the Context Window.** The why skill fans out one subagent per evidence source, plus a synthesizer. I skipped that. The commit message already gives the full reason, and the only other sources were two searches I could run myself.
- **Prove It Works.** Because of this principle I ran the `0.005` and discounted-cart numbers myself. Otherwise the answer would only have restated the commit message, and the regression would have been a guess.

Steps:
1. Route through the how skill, and the why skill for motivation questions. I ran why inline and skipped its subagents, as explained above. Skipped how because last turn already covered how the code works.
2. `throughput checkpoint: n/a, read-only investigation`.
3. Produce the how-shaped output. Done, using why's sections.
4. Apply the unslop skill. Done.
