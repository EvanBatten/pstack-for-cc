=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] says (interim): I'll take a quick look at the repo, then hand this to the poteto agent, which `/poteto-mode` routes to.
e3 [main] run: git ls-files && git log --oneline -5 && cat package.json 2>/dev/null
e4 [main] spawn poteto-agent delegate, model tier top, foreground. Brief: /poteto-mode. Read the poteto-mode SKILL.md in full first (<pstack>/poteto-mode/SKILL.md), follow the Feature playbook, and read the leaf SKILL.md for each principle you apply.

Repo: <repo> (git, branch main, clean). Node ESM, tests via `npm test` (node --test). Files: src/cart.js, src/money.js, src/shipping.js, test/cart.test.js, README.md. Recent commits added flat shipping, percentage discounts, and per-line cent rounding. Read existing code first and match its style and money representation.

User request, verbatim: "Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests."

Requirements:
- Model coupons as a data registry (code -> discount rule), not scattered condi [...887 more chars]
e5 [main] says (interim): I'll check the diff and run the tests myself before reporting back.
e6 [main] run: git log --oneline -3 && git show HEAD~1 HEAD -- src && npm test 2>&1 | tail -9
e7 [main] REPLY TO USER:
Coupon codes work. `SAVE10` and `FLAT5` are in, only one code is allowed per order, and an unknown code throws `Unknown coupon code "BOGUS"`. I reviewed the diff and reran `npm test` myself: 13 of 13 tests pass. The work is two commits on `main`, not pushed.

**Something to know first.** `main` was already failing a test before any coupon work. `computeTotal` treated `discountPct: 10` as the multiplier 10, not 10 percent, so the "10% discount" test returned -355. The first commit (`729e8eb`) fixes that with a small `percentOf` helper in `src/money.js`. The coupon commit (`ea0058a`) is built on that fix.

**How to use it.** Pass the code the customer typed: `computeTotal(items, { coupons: ["SAVE10"] })`. The codes live in a lookup table in the new `src/coupons.js`. Adding a code means adding one entry to that table.

**Behaviour choices.** Each of these has a test that checks the exact total:
- Case and surrounding spaces are ignored, so `" save10 "` works.
- Passing two codes throws `Only one coupon code per order, got "SAVE10", "FLAT5"`. This includes passing the same code twice. Swapping codes just means sending the new one.
- `FLAT5` never takes the subtotal below 0. A 3.00 cart pays only the 5.00 shipping.
- The `SAVE10` discount is rounded to cents. A 0.99 subtotal comes to 5.89 with shipping.
- Shipping is never discounted.

**One pricing decision is yours.** If an order has both a coupon and the existing percentage discount, the coupon comes off first. The percentage then applies to what's left: 40, then 36 after `SAVE10`, then 32.40 after 10% off, then 37.40 with shipping. Doing it in that order means the total can't go negative. If you'd rather work out both discounts from the original subtotal, that's a one-line change in `computeTotal` plus one test update.

**Principles.** These came from the poteto agent, which read the principle files. I checked the code against its claims.
- **Model the Domain** is why the codes are a lookup table instead of a chain of `if` checks.
- **Boundary Discipline** is why the input cleanup and both errors sit in `couponDiscount`, and the discount rules themselves stay simple.
- **Fix Root Causes** and **Sequence Work into Verifiable Units** are why the broken baseline was fixed first, in its own commit.
- **Test Behavior, Not Implementation** is why every test calls `computeTotal` and checks an exact value. The agent also replaced `couponDiscount` with a stub that returns 0, and 8 of the 9 new tests failed. The ninth, the empty-cart case, fails if the "never below 0" limit is removed.

The README now has a Coupons section.No follow-up is needed. These were the agent's own background steps and my test rerun, and all of them finished successfully. They match what I reported: two commits on `main`, 13 of 13 tests passing, nothing pushed. The only open item is still your call on the pricing order when a coupon and the percentage discount are used together.

--- delegate d1 (poteto-agent, spawned at e4) ---
e8 [d1] BRIEF RECEIVED: <timestamp>Thursday, Sep 24, 2026, 3:44 PM (UTC-4)</timestamp>
<user_query>
/poteto-mode. Read the poteto-mode SKILL.md in full first (<pstack>/poteto-mode/SKILL.md), follow the Feature playbook, and read the leaf SKILL.md for each principle you apply.

Repo: <repo> (git, branch main, clean). Node ESM, tests via `npm test` (node --test). Files: src/cart.js, src/money.js, src/shipping.js, test/cart.test.js, README.md. Recent commits added flat shipping, percentage discounts, and per-line cent rounding. Read existing code first and match its style and money representation.

User request, verbatim: "Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests."

Requirements:
- M [...977 more chars]
e9 [d1] says (interim): I'll read the poteto-mode skill first, then the repo.

I should start by opening the SKILL.md file to see what instructions it contains.


e10 [d1] read <pstack>/poteto-mode/SKILL.md (full)
e11 [d1] run: cd <repo> && git status && git log --oneline -10 && ls -R src test && cat package.json README.md src/*.js test/*.js
e12 [d1] says (interim): The existing discount test passes `discountPct: 10` but the code treats it as a fraction, so it probably fails today. I'll confirm that and read the Feature playbook and principle leaves.

I notice the "applies a 10% discount before shipping" test expects 41, but the code computes discountPct as a fraction rather than a percent, producing a negative result instead. That means there's a semantic mismatch: the test assumes discountPct: 10 means 10%, while the code treats it as a raw fraction, so I need to fix this discrepancy.


e13 [d1] run: cd <repo> && npm test 2>&1 | tail -30; ls <pstack>/ ; cat <pstack>/poteto-mode/playbooks/feature.md
e14 [d1] read <pstack>/poteto-mode/playbooks/feature.md (full)
e15 [d1] says (interim): The failing test expects discountPct to be treated as a percentage, so the fix is to divide by 100 rather than treat it as a raw fraction, matching both the naming and the commit history. This should be its own commit, sequenced separately as a verifiable unit, following the principles of modeling the domain, testing behavior, and proving it works.

Since I'm a subagent that can't spawn others, I need to own this diff myself — checking fix-root-causes, sequence-verifiable-units, and subtract-before-you-add, while keeping the change clean per no-comments and deslop guidance.


The baseline test fails because `cart.js` treats `discountPct: 10` as a fraction while it's meant to be a percent. I'll check the relevant principle leaves before deciding on a fix.


e16 [d1] run: cd <pstack> && for s in principle-model-the-domain principle-fix-root-causes principle-test-behavior-not-implementation principle-laziness-protocol principle-foundational-thinking principle-redesign-from-first-principles principle-boundary-discipline principle-sequence-verifiable-units principle-prove-it-works principle-never-block-on-the-human; do echo "=== $s"; cat $s/SKILL.md; done
e17 [d1] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e18 [d1] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e19 [d1] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e20 [d1] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e21 [d1] read <pstack>/poteto-mode/principles/foundational-thinking.md (full)
e22 [d1] read <pstack>/poteto-mode/principles/redesign-from-first-principles.md (full)
e23 [d1] read <pstack>/poteto-mode/principles/boundary-discipline.md (full)
e24 [d1] read <pstack>/poteto-mode/principles/sequence-verifiable-units.md (full)
e25 [d1] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e26 [d1] read <pstack>/poteto-mode/principles/never-block-on-the-human.md (full)
e27 [d1] run: cd <pstack> && for s in how architect no-comments deslop technical-writing; do echo "=== $s"; cat $s/SKILL.md; done
e28 [d1] read <pstack>/how/SKILL.md (full)
e29 [d1] read <pstack>/architect/SKILL.md (full)
e30 [d1] read <pstack>/no-comments/SKILL.md (full)
e31 [d1] read <pstack>/deslop/SKILL.md (full)
e32 [d1] read <pstack>/technical-writing/SKILL.md (full)
e33 [d1] says (interim): I'm thinking about the data shape for coupons—maybe a simple object mapping codes to percent/flat discount info, or alternatively a registry of functions where each code maps to a function that computes the discount amount from the subtotal. The function-based registry seems cleaner and more extensible.

The trickier issue is enforcing "one code per order" when the API is stateless—computeTotal just takes items and options, so there's no persistent order object to check against. I'm weighing whether to accept an array of coupon codes and throw if more than one is given, or introduce something like an applyCoupon function that rejects a second code, though that feels awkward without a real order object to attach state to.

I keep going back and forth but land on `computeTotal(items, { discountPct, coupons = [] })`, treating coupons as an array so the checkout can collect multiple entered codes while pricing enforces the one-code rule at the boundary. This makes replacement explicit too — the caller just passes a new list rather than pricing silently choosing one, which I'll document clearly.

For normalization, I want to trim and uppercase codes so "save10 " still matches, but keep error messages showing the raw entered value via JSON.stringify so whitespace issues are visible to the user. I still need to decide how duplicate codes in the same request should be handled.

For the ordering of discounts, I'm settling on computing both the coupon amount and the percentage discount [...1677 more chars]
e34 [d1] task list update: [done] 1. `how` over the affected subsystem. (skip: three files under 15 lines each, read in full directly); [done] 2. `architect` for parallel design exploration. (architect skipped: one new pure function behind an existing option; design alternatives weighed inline); [done] 3. Throughput checkpoint. Blocking first steps: fix red baseline (discountPct). Independent workstreams: n/a, two small coupled files. Shared mutable state: n/a, pure functions. Smallest safe decomposition: one worker, code is coupled through computeTotal; [doing] 4. Delegate code-writing (subagent forbidden to spawn: own the diff directly with review separation); [todo] 5. Verify on the matching surface (npm test + direct node calls); [todo] 6. Small ordered commits: discount fix, then coupons; [todo] 7. interrogate if contested (skip unless contested); [todo] 8. Opening a PR (skip: user said commit on main, do not push)
e35 [d1] says (interim): The first unit fixes the red baseline. `discountPct` is a percent, as the name and the test say. I'll add a `percentOf` helper to `money.js` that coupons will reuse.
e36 [d1] edit <repo>/src/money.js
e37 [d1] edit <repo>/src/cart.js
e38 [d1] run: cd <repo> && npm test 2>&1 | rg "^ℹ (pass|fail)" && git add -A && git commit -qm "treat discountPct as a percent, not a fraction

computeTotal multiplied the subtotal by (1 - discountPct), so
discountPct: 10 produced a negative total. The option name and its
test both mean 10 percent. Add percentOf to money.js and use it." && git log --oneline -1
e39 [d1] says (interim): Baseline is green (4 pass) and committed. Now the coupon registry in its own module, matching how `shipping.js` owns shipping.

Baseline test passes and is committed. Moving on to work on coupons now.


e40 [d1] edit <repo>/src/coupons.js
e41 [d1] edit <repo>/src/cart.js
e42 [d1] says (interim): I'm working through test cases: applying SAVE10 to a $20x2 order plus shipping gives $41, FLAT5 gives $40, and checking rounding behavior with a $0.99 item nets $5.89. Now I'm checking the FLAT5 case for a small order under $5.

I also need cases for whitespace/case-insensitive coupon codes, unknown codes throwing an error with a specific message, rejecting multiple coupon codes on one order, combining a discount percentage with SAVE10, and applying FLAT5 to an empty cart. I'm noting that assert.throws should match the exact error message for the unknown coupon case.


e43 [d1] edit <repo>/test/cart.test.js
e44 [d1] edit <repo>/README.md
e45 [d1] says (interim): Now I'll run the suite, then check that the tests can fail by swapping `couponDiscount` for a stub that returns 0.

I should also verify the tests actually catch failures — maybe try stubbing couponDiscount to return 0 and confirm the tests break, as a quick mutation check.


e46 [d1] run: cd <repo> && npm test 2>&1; cp src/coupons.js /tmp/c.js && printf 'export const couponDiscount = () => 0;\n' > src/coupons.js && npm test 2>&1 | rg "^ℹ (pass|fail)"; cp /tmp/c.js src/coupons.js && git status --short
e47 [d1] says (interim): 13 pass under the real implementation, while the stubbed version fails 8, though the empty-cart FLAT5 case slips through since a stub returning undefined produces NaN rather than a valid low value — so it's a weak test that mainly guards against the shipping cap misbehaving on an empty cart.

The diff has no added comments and looks clean, so I'll commit.


All 13 tests pass, and the stub correctly fails 8 of 9 coupon tests, with only the empty-cart FLAT5 case passing since it expects 0 regardless. Committing now.


e48 [d1] run: cd <repo> && git add -A && git commit -qm "add SAVE10 and FLAT5 coupon codes

src/coupons.js maps each code to a rule on the subtotal. computeTotal
takes the entered codes as { coupons: [...] }, applies the coupon to
the subtotal before discountPct and shipping, and throws on an
unknown code or on more than one code. Codes ignore case and
surrounding whitespace. FLAT5 never takes the subtotal belo [...70 more chars]
e49 [d1] task list update: [done] 4. Delegate code-writing (owned directly); [done] 5. Verify: npm test 13/13, stub mutation fails 8 tests; [done] 6. Two ordered commits on main; [skipped] 7. interrogate (skip: design not contested); [skipped] 8. Opening a PR (skip: user said do not push)
e50 [d1] says (interim): Checkout can now take `SAVE10` and `FLAT5` coupon codes. You pass them as `computeTotal(items, { coupons: ["SAVE10"] })`. An unknown code or a second code throws an error that names the code. All 13 tests pass, and the work is in two commits on `main`, not pushed.

The first commit fixes a bug I found before starting. `main` was already failing one test. "applies a 10% discount before shipping" returned -355 because `computeTotal` treated `discountPct: 10` as the fraction 10 rather than 10 percent. Coupons build on that discount code, so I fixed it first.

**Diff summary.**
- `729e8eb` "treat discountPct as a percent, not a fraction". This adds `percentOf(amount, pct)` to `src/money.js` and uses it in `computeTotal`. Two files, 4 lines changed.
- `ea0058a` "add SAVE10 and FLAT5 coupon codes". The new `src/coupons.js` (17 lines) holds a `Map` from each code to a rule on the subtotal, plus `couponDiscount(codes, subtotal)`. `computeTotal` gains the `coupons = []` option. There are 9 new tests in `test/cart.test.js`, and a Coupons section in `README.md`.

**Design choices and the principle behind each.**
- **Fix Root Causes.** I fixed the red test in `computeTotal` itself, not around it. The option's name and its only test both mean a percent, so the formula was wrong, not the test. It lands as its own commit first (**Sequence Work into Verifiable Units**), so the coupon commit starts from a passing suite.
- **Model the Domain.** Coupons are a `Map` in their own module, the same [...4920 more chars]
e51 [d1] says (interim): I'll re-read the principle leaves I plan to cite, and check whether summing cent-rounded lines can drift below 20 in floating point.

I should re-read the leaves I'm citing—model-the-domain, subtract-before-you-add, test-behavior, and laziness—since the instructions call for re-reading any leaf referenced. I'm also sketching out the coupon entry shape with a minimum subtotal and discount field, along with an error message for invalid coupon codes.

I'm settling on wording like "Coupon code 'FLAT5' needs a subtotal of at least 20.00. Add 7.50 more to use it," and working out the shortfall calculation with cent rounding to avoid floating-point issues like 20-19.99 producing a messy decimal. I'm also deciding to use the canonical coupon name in this message since a normalized key is clearer, while raw input is still needed for the unknown-code case since there's no canonical name to fall back on there—then checking that the subtotal comparison against the minimum also uses rounded cents to avoid float precision problems.

Since summing rounded line totals can still drift slightly due to floating point, I'm considering rounding the subtotal itself right at the source in the cart computation rather than just at comparison time, since that's a cleaner fix and directly matters for the edge case where a cart should total exactly 20.00. I want to verify whether such drift actually occurs with some sample values before deciding whether to add a dedicated test for it.


e52 [d1] run: cd <pstack> && for s in principle-model-the-domain principle-subtract-before-you-add principle-test-behavior-not-implementation principle-laziness-protocol principle-fix-root-causes; do echo "=== $s"; sed -n '5,200p' $s/SKILL.md; done; node -e "for (const xs of [[6.66,6.67,6.67],[6.67,6.67,6.66],[0.1,0.2,19.7],[19.7,0.2,0.1],[10.1,9.9]]) console.log(xs, xs.reduce((a,b)=>a+b,0)); console.log(20-19. [...13 more chars]
e53 [d1] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e54 [d1] read <pstack>/poteto-mode/principles/subtract-before-you-add.md (full)
e55 [d1] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e56 [d1] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e57 [d1] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e58 [d1] says (interim): Those sums landed exactly on 20. I'll brute-force two- and three-line carts whose cents add to 20.00, to see if any float sum comes out below 20.

I'm checking other pairs for floating point drift, wondering if any cent combinations summing to 20.00 produce rounding errors like 0.1+0.2 does.


e59 [d1] run: node -e "let n=0,ex;for(let a=1;a<2000;a++)for(let b=1;a+b<2000;b++){const c=2000-a-b;const s=a/100+b/100+c/100;if(s<20){n++;ex=ex||[a,b,c,s]}}console.log(n,ex)"
e60 [d1] says (interim): I see the floating-point issue: 0.02+16.08+3.90 actually evaluates to 19.999999999999996, which would incorrectly reject a valid $20 order. I'll fix this at the root by rounding the subtotal once inside computeTotal, and add a test covering that exact cart.


Found a real bug: rounding errors cause a subtotal of 19.999999999999996 instead of 20.00, incorrectly rejecting the order. I'll fix it by rounding once in `computeTotal` and add this cart as a test case.


e61 [d1] edit <repo>/src/coupons.js
e62 [d1] edit <repo>/src/cart.js
e63 [d1] edit <repo>/test/cart.test.js
e64 [d1] edit <repo>/README.md
e65 [d1] says (interim): Running the suite, then a check that the drift test fails when the subtotal rounding is removed.

The README's note about an order taking exactly one code and throwing on multiple or unknown ones looks fine. I should run the tests, then try a mutation test by removing the roundCents call on subtotal to confirm the drift test actually catches it.


e66 [d1] run: cd <repo> && npm test 2>&1; cp src/cart.js /tmp/cart.js && sed -i 's/roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0))/items.reduce((sum, item) => sum + lineTotal(item), 0)/' src/cart.js && npm test 2>&1 | rg "^(✖|ℹ (pass|fail))"; cp /tmp/cart.js src/cart.js && git diff --stat
e67 [d1] run: cd <repo> && git add -A && git commit -qm "require a 20 subtotal for FLAT5

Coupon entries become { minSubtotal, discount }. Below the minimum,
couponDiscount throws with the code, the minimum, and the shortfall
to two decimals. The Math.min(5, subtotal) cap is gone because the
subtotal is now at least 20.

computeTotal now rounds the subtotal to cents. Without that, lines of
0.02, 16.08 and 3.90  [...159 more chars]
e68 [d1] FINAL MESSAGE TO PARENT:
`FLAT5` now needs a subtotal of at least 20. Below that it throws an error that tells the customer how much more to add. All 16 tests pass, and the change is one commit on `main` (`5642422`), not pushed.

While testing, I found and fixed a bug the new minimum would have exposed. Some carts that add up to exactly 20.00 were summed as just under 20 because of floating-point error. Three lines of 0.02, 16.08, and 3.90 sum to `19.999999999999996`, so a real 20.00 order would be rejected with "Add 0.00 more". `computeTotal` now rounds the subtotal to cents once, before any coupon check. I found this case by checking every three-line cart whose cents add up to 20.00: 49,376 of them came out below 20. It's now a test, and that test fails if the subtotal rounding is removed.

**Error message format.**

```
Coupon code "<CODE>" needs a subtotal of at least <min>. Add <shortfall> more to use it.
```

- `<CODE>` is the code as looked up (trimmed and uppercased), so `"flat5"` is reported as `FLAT5`.
- `<min>` and `<shortfall>` are rounded to cents and always shown with two decimals.
- 19.99 gives `Add 0.01 more`, 12.50 gives `Add 7.50 more`, and an empty cart gives `Add 20.00 more`.
- Exactly 20 is accepted.

**Choices, and the principle behind each.**
- **Model the Domain.** The minimum lives in the registry data, with no `if (code === "FLAT5")`. Each entry is now `{ minSubtotal, discount }`. That's the smallest change that turns the minimum into data. One comparison in `couponDiscount` covers every code, and a future code with a minimum is a one-line entry. `SAVE10` gets `minSubtotal: 0`, so its behavior is unchanged and its tests are untouched.
- **Subtract Before You Add.** The `Math.min(5, subtotal)` cap is gone, because a subtotal of 20 or more can never go negative. `FLAT5`'s rule is now `() => 5`. I deleted the two tests that only covered the cap ("under 5" and "empty cart costs nothing").
- **Fix Root Causes.** The float problem is fixed where the subtotal is computed in `cart.js`. I didn't patch it with a tolerance in the coupon check. Every later step now sees a subtotal already rounded to cents.
- **Test Behavior, Not Implementation.** Each new test calls `computeTotal` and checks an exact total or an exact error message. They cover:
  - exactly 20;
  - three lines that add up to exactly 20;
  - 19.99;
  - 12.50, entered as lowercase `flat5`;
  - an empty cart.
- **Laziness Protocol.** The whole change is 4 files and a net +25 lines. There's no new module or helper, since the shortfall reuses `roundCents` and `toFixed`.

**Diff.**

```diff
--- a/src/coupons.js
+++ b/src/coupons.js
-import { percentOf } from "./money.js";
+import { percentOf, roundCents } from "./money.js";
 
 const COUPONS = new Map([
-  ["SAVE10", (subtotal) => percentOf(subtotal, 10)],
-  ["FLAT5", (subtotal) => Math.min(5, subtotal)],
+  ["SAVE10", { minSubtotal: 0, discount: (subtotal) => percentOf(subtotal, 10) }],
+  ["FLAT5", { minSubtotal: 20, discount: () => 5 }],
 ]);
@@ export function couponDiscount(codes, subtotal) {
-  const [code] = codes;
-  const rule = COUPONS.get(code.trim().toUpperCase());
-  if (!rule) throw new Error(`Unknown coupon code ${JSON.stringify(code)}`);
-  return rule(subtotal);
+  const code = codes[0].trim().toUpperCase();
+  const coupon = COUPONS.get(code);
+  if (!coupon) throw new Error(`Unknown coupon code ${JSON.stringify(codes[0])}`);
+  if (subtotal < coupon.minSubtotal) {
+    const shortfall = roundCents(coupon.minSubtotal - subtotal).toFixed(2);
+    throw new Error(
+      `Coupon code "${code}" needs a subtotal of at least ${coupon.minSubtotal.toFixed(2)}. Add ${shortfall} more to use it.`,
+    );
+  }
+  return coupon.discount(subtotal);
 }

--- a/src/cart.js
+++ b/src/cart.js
-  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
+  const subtotal = roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0));

--- a/README.md
+++ b/README.md
-- `FLAT5` takes 5 off the subtotal. It never takes the subtotal below 0.
+- `FLAT5` takes 5 off a subtotal of 20 or more. Below 20, `computeTotal` throws an error with the amount the customer still needs to add, for example `Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 7.50 more to use it.`

--- a/test/cart.test.js
+++ b/test/cart.test.js
-test("FLAT5 on a subtotal under 5 zeroes the subtotal but keeps shipping", () => {
-  assert.equal(computeTotal([{ price: 3, qty: 1 }], { coupons: ["FLAT5"] }), 5);
+test("FLAT5 is accepted at exactly 20", () => {
+  assert.equal(computeTotal([{ price: 20, qty: 1 }], { coupons: ["FLAT5"] }), 20);
 });
 
-test("FLAT5 on an empty cart costs nothing", () => {
-  assert.equal(computeTotal([], { coupons: ["FLAT5"] }), 0);
+test("FLAT5 is accepted when lines add up to exactly 20", () => {
+  const items = [{ price: 0.02, qty: 1 }, { price: 16.08, qty: 1 }, { price: 3.9, qty: 1 }];
+  assert.equal(computeTotal(items, { coupons: ["FLAT5"] }), 20);
+});
+
+test("FLAT5 just below 20 asks for one more cent", () => {
+  assert.throws(() => computeTotal([{ price: 19.99, qty: 1 }], { coupons: ["FLAT5"] }), {
+    message: 'Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 0.01 more to use it.',
+  });
+});
+
+test("FLAT5 below 20 names the shortfall", () => {
+  assert.throws(() => computeTotal([{ price: 2.5, qty: 5 }], { coupons: ["flat5"] }), {
+    message: 'Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 7.50 more to use it.',
+  });
+});
+
+test("FLAT5 on an empty cart asks for the full minimum", () => {
+  assert.throws(() => computeTotal([], { coupons: ["FLAT5"] }), {
+    message: 'Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 20.00 more to use it.',
+  });
 });
```

**Full `npm test` output.**

```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (2.3611ms)
✔ rounds each line to cents (0.3116ms)
✔ applies a 10% discount before shipping (0.2947ms)
✔ an empty cart costs nothing (0.2477ms)
✔ SAVE10 takes 10% off the subtotal, not shipping (0.3504ms)
✔ SAVE10 rounds the discount to cents (0.2714ms)
✔ FLAT5 takes 5 off the subtotal, not shipping (0.3253ms)
✔ FLAT5 is accepted at exactly 20 (0.2439ms)
✔ FLAT5 is accepted when lines add up to exactly 20 (0.357ms)
✔ FLAT5 just below 20 asks for one more cent (1.1079ms)
✔ FLAT5 below 20 names the shortfall (0.3022ms)
✔ FLAT5 on an empty cart asks for the full minimum (0.1579ms)
✔ codes ignore case and surrounding whitespace (0.1134ms)
✔ the percentage discount applies after the coupon (0.1236ms)
✔ an unknown code is rejected by name (0.1471ms)
✔ a second code is rejected (0.281ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1965.9444
```

**Open decision.** The minimum is checked against the subtotal before the percentage discount and before shipping, as you asked. So a 20.00 cart with `discountPct: 10` still qualifies for `FLAT5`. If the minimum should apply to the price after that discount, the check has to move after the discount step in `computeTotal`, which changes the order in which the discount and coupon are applied.

I'm ready to write the reply now, keeping it natural and avoiding em dashes or mid-sentence colons.


--- end of delegate d1 ---

=== turn t1 ===
e69 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e70 [main] says (interim): I'll send this follow-up to the same poteto agent, since it already has the coupon code loaded.
e71 [main] spawn poteto-agent delegate, model tier top, foreground. Brief: Follow-up from the user, verbatim: "FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add."

Stay in poteto-mode (re-read any principle leaf you cite). Guidance:
- Keep it in the coupon registry: a minimum subtotal belongs to the coupon's data, not a special-case `if (code === "FLAT5")`. Pick the smallest shape change (e.g. entries become `{ minSubtotal, discount }` or similar) and say why.
- Exactly 20 is accepted. Below 20 throws an error naming the code, the minimum, and the shortfall rounded to cents, formatted with two decimals (e.g. subtotal 12.5 -> "add 7.50 more"). Watch float error (e.g. 19.99 -> 0.01, not 0.009999).
- The `Math.min(5, subtotal)` cap i [...486 more chars]
e72 [main] run: git log --oneline -2 && git status --short && npm test 2>&1 | rg "^ℹ (tests|pass|fail)"
e73 [main] REPLY TO USER:
`FLAT5` now only applies when the subtotal is at least 20.00, and exactly 20.00 counts. Below that, it throws an error that tells the customer how much more to add:

```
Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 7.50 more to use it.
```

The change is one commit on `main` (`5642422`), not pushed. I reran `npm test` myself and all 16 tests pass.

**A bug this would have exposed.** Some carts that add up to exactly 20.00 came out as `19.999999999999996` because of floating-point error. One example is items at 0.02, 16.08 and 3.90. Those orders would have been wrongly rejected with "Add 0.00 more". `computeTotal` now rounds the subtotal to cents before any coupon check, and one of the new tests uses that exact cart.

**Principles.**
- **Model the Domain** is why the minimum is stored with each coupon's entry rather than as a special check for `FLAT5`. Each entry is now `{ minSubtotal, discount }`. `SAVE10` has a minimum of 0, so it behaves exactly as before.
- **Subtract Before You Add** is why the old rule that kept `FLAT5` from pushing a total below zero was deleted. With a 20.00 minimum that can't happen anymore. Its two tests were replaced by tests for:
  - exactly 20.00;
  - a cart whose items add up to exactly 20.00;
  - 19.99, which asks for 0.01 more;
  - 12.50 entered as `flat5`, which asks for 7.50 more;
  - an empty cart, which asks for 20.00 more.
- **Fix Root Causes** is why the rounding fix went where the subtotal is added up, instead of making the coupon check allow a small margin.

The README's Coupons section shows the new rule and the error message.

**Decision for you.** The 20.00 minimum is checked before the existing percentage discount is applied, so a 20.00 cart with a 10% discount still qualifies for `FLAT5`. If the minimum should use the price after that discount, the order of steps in `computeTotal` has to change.No follow-up is needed. That notification is the agent's commit of the `FLAT5` minimum (`5642422`), which I already checked. All 16 tests pass, and nothing is pushed. The only open question is still yours: should the 20.00 minimum be checked before or after the percentage discount?

--- delegate d2 (poteto-agent, spawned at e71) ---
e74 [d2] BRIEF RECEIVED: <timestamp>Thursday, Sep 24, 2026, 3:44 PM (UTC-4)</timestamp>
<user_query>
/poteto-mode. Read the poteto-mode SKILL.md in full first (<pstack>/poteto-mode/SKILL.md), follow the Feature playbook, and read the leaf SKILL.md for each principle you apply.

Repo: <repo> (git, branch main, clean). Node ESM, tests via `npm test` (node --test). Files: src/cart.js, src/money.js, src/shipping.js, test/cart.test.js, README.md. Recent commits added flat shipping, percentage discounts, and per-line cent rounding. Read existing code first and match its style and money representation.

User request, verbatim: "Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests."

Requirements:
- M [...977 more chars]
e75 [d2] says (interim): I'll read the poteto-mode skill first, then the repo.

I should start by opening the SKILL.md file to see what instructions it contains.


e76 [d2] read <pstack>/poteto-mode/SKILL.md (full)
e77 [d2] run: cd <repo> && git status && git log --oneline -10 && ls -R src test && cat package.json README.md src/*.js test/*.js
e78 [d2] says (interim): The existing discount test passes `discountPct: 10` but the code treats it as a fraction, so it probably fails today. I'll confirm that and read the Feature playbook and principle leaves.

I notice the "applies a 10% discount before shipping" test expects 41, but the code computes discountPct as a fraction rather than a percent, producing a negative result instead. That means there's a semantic mismatch: the test assumes discountPct: 10 means 10%, while the code treats it as a raw fraction, so I need to fix this discrepancy.


e79 [d2] run: cd <repo> && npm test 2>&1 | tail -30; ls <pstack>/ ; cat <pstack>/poteto-mode/playbooks/feature.md
e80 [d2] read <pstack>/poteto-mode/playbooks/feature.md (full)
e81 [d2] says (interim): The failing test expects discountPct to be treated as a percentage, so the fix is to divide by 100 rather than treat it as a raw fraction, matching both the naming and the commit history. This should be its own commit, sequenced separately as a verifiable unit, following the principles of modeling the domain, testing behavior, and proving it works.

Since I'm a subagent that can't spawn others, I need to own this diff myself — checking fix-root-causes, sequence-verifiable-units, and subtract-before-you-add, while keeping the change clean per no-comments and deslop guidance.


The baseline test fails because `cart.js` treats `discountPct: 10` as a fraction while it's meant to be a percent. I'll check the relevant principle leaves before deciding on a fix.


e82 [d2] run: cd <pstack> && for s in principle-model-the-domain principle-fix-root-causes principle-test-behavior-not-implementation principle-laziness-protocol principle-foundational-thinking principle-redesign-from-first-principles principle-boundary-discipline principle-sequence-verifiable-units principle-prove-it-works principle-never-block-on-the-human; do echo "=== $s"; cat $s/SKILL.md; done
e83 [d2] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e84 [d2] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e85 [d2] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e86 [d2] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e87 [d2] read <pstack>/poteto-mode/principles/foundational-thinking.md (full)
e88 [d2] read <pstack>/poteto-mode/principles/redesign-from-first-principles.md (full)
e89 [d2] read <pstack>/poteto-mode/principles/boundary-discipline.md (full)
e90 [d2] read <pstack>/poteto-mode/principles/sequence-verifiable-units.md (full)
e91 [d2] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e92 [d2] read <pstack>/poteto-mode/principles/never-block-on-the-human.md (full)
e93 [d2] run: cd <pstack> && for s in how architect no-comments deslop technical-writing; do echo "=== $s"; cat $s/SKILL.md; done
e94 [d2] read <pstack>/how/SKILL.md (full)
e95 [d2] read <pstack>/architect/SKILL.md (full)
e96 [d2] read <pstack>/no-comments/SKILL.md (full)
e97 [d2] read <pstack>/deslop/SKILL.md (full)
e98 [d2] read <pstack>/technical-writing/SKILL.md (full)
e99 [d2] says (interim): I'm thinking about the data shape for coupons—maybe a simple object mapping codes to percent/flat discount info, or alternatively a registry of functions where each code maps to a function that computes the discount amount from the subtotal. The function-based registry seems cleaner and more extensible.

The trickier issue is enforcing "one code per order" when the API is stateless—computeTotal just takes items and options, so there's no persistent order object to check against. I'm weighing whether to accept an array of coupon codes and throw if more than one is given, or introduce something like an applyCoupon function that rejects a second code, though that feels awkward without a real order object to attach state to.

I keep going back and forth but land on `computeTotal(items, { discountPct, coupons = [] })`, treating coupons as an array so the checkout can collect multiple entered codes while pricing enforces the one-code rule at the boundary. This makes replacement explicit too — the caller just passes a new list rather than pricing silently choosing one, which I'll document clearly.

For normalization, I want to trim and uppercase codes so "save10 " still matches, but keep error messages showing the raw entered value via JSON.stringify so whitespace issues are visible to the user. I still need to decide how duplicate codes in the same request should be handled.

For the ordering of discounts, I'm settling on computing both the coupon amount and the percentage discount [...1677 more chars]
e100 [d2] task list update: [done] 1. `how` over the affected subsystem. (skip: three files under 15 lines each, read in full directly); [done] 2. `architect` for parallel design exploration. (architect skipped: one new pure function behind an existing option; design alternatives weighed inline); [done] 3. Throughput checkpoint. Blocking first steps: fix red baseline (discountPct). Independent workstreams: n/a, two small coupled files. Shared mutable state: n/a, pure functions. Smallest safe decomposition: one worker, code is coupled through computeTotal; [doing] 4. Delegate code-writing (subagent forbidden to spawn: own the diff directly with review separation); [todo] 5. Verify on the matching surface (npm test + direct node calls); [todo] 6. Small ordered commits: discount fix, then coupons; [todo] 7. interrogate if contested (skip unless contested); [todo] 8. Opening a PR (skip: user said commit on main, do not push)
e101 [d2] says (interim): The first unit fixes the red baseline. `discountPct` is a percent, as the name and the test say. I'll add a `percentOf` helper to `money.js` that coupons will reuse.
e102 [d2] edit <repo>/src/money.js
e103 [d2] edit <repo>/src/cart.js
e104 [d2] run: cd <repo> && npm test 2>&1 | rg "^ℹ (pass|fail)" && git add -A && git commit -qm "treat discountPct as a percent, not a fraction

computeTotal multiplied the subtotal by (1 - discountPct), so
discountPct: 10 produced a negative total. The option name and its
test both mean 10 percent. Add percentOf to money.js and use it." && git log --oneline -1
e105 [d2] says (interim): Baseline is green (4 pass) and committed. Now the coupon registry in its own module, matching how `shipping.js` owns shipping.

Baseline test passes and is committed. Moving on to work on coupons now.


e106 [d2] edit <repo>/src/coupons.js
e107 [d2] edit <repo>/src/cart.js
e108 [d2] says (interim): I'm working through test cases: applying SAVE10 to a $20x2 order plus shipping gives $41, FLAT5 gives $40, and checking rounding behavior with a $0.99 item nets $5.89. Now I'm checking the FLAT5 case for a small order under $5.

I also need cases for whitespace/case-insensitive coupon codes, unknown codes throwing an error with a specific message, rejecting multiple coupon codes on one order, combining a discount percentage with SAVE10, and applying FLAT5 to an empty cart. I'm noting that assert.throws should match the exact error message for the unknown coupon case.


e109 [d2] edit <repo>/test/cart.test.js
e110 [d2] edit <repo>/README.md
e111 [d2] says (interim): Now I'll run the suite, then check that the tests can fail by swapping `couponDiscount` for a stub that returns 0.

I should also verify the tests actually catch failures — maybe try stubbing couponDiscount to return 0 and confirm the tests break, as a quick mutation check.


e112 [d2] run: cd <repo> && npm test 2>&1; cp src/coupons.js /tmp/c.js && printf 'export const couponDiscount = () => 0;\n' > src/coupons.js && npm test 2>&1 | rg "^ℹ (pass|fail)"; cp /tmp/c.js src/coupons.js && git status --short
e113 [d2] says (interim): 13 pass under the real implementation, while the stubbed version fails 8, though the empty-cart FLAT5 case slips through since a stub returning undefined produces NaN rather than a valid low value — so it's a weak test that mainly guards against the shipping cap misbehaving on an empty cart.

The diff has no added comments and looks clean, so I'll commit.


All 13 tests pass, and the stub correctly fails 8 of 9 coupon tests, with only the empty-cart FLAT5 case passing since it expects 0 regardless. Committing now.


e114 [d2] run: cd <repo> && git add -A && git commit -qm "add SAVE10 and FLAT5 coupon codes

src/coupons.js maps each code to a rule on the subtotal. computeTotal
takes the entered codes as { coupons: [...] }, applies the coupon to
the subtotal before discountPct and shipping, and throws on an
unknown code or on more than one code. Codes ignore case and
surrounding whitespace. FLAT5 never takes the subtotal belo [...70 more chars]
e115 [d2] task list update: [done] 4. Delegate code-writing (owned directly); [done] 5. Verify: npm test 13/13, stub mutation fails 8 tests; [done] 6. Two ordered commits on main; [skipped] 7. interrogate (skip: design not contested); [skipped] 8. Opening a PR (skip: user said do not push)
e116 [d2] says (interim): Checkout can now take `SAVE10` and `FLAT5` coupon codes. You pass them as `computeTotal(items, { coupons: ["SAVE10"] })`. An unknown code or a second code throws an error that names the code. All 13 tests pass, and the work is in two commits on `main`, not pushed.

The first commit fixes a bug I found before starting. `main` was already failing one test. "applies a 10% discount before shipping" returned -355 because `computeTotal` treated `discountPct: 10` as the fraction 10 rather than 10 percent. Coupons build on that discount code, so I fixed it first.

**Diff summary.**
- `729e8eb` "treat discountPct as a percent, not a fraction". This adds `percentOf(amount, pct)` to `src/money.js` and uses it in `computeTotal`. Two files, 4 lines changed.
- `ea0058a` "add SAVE10 and FLAT5 coupon codes". The new `src/coupons.js` (17 lines) holds a `Map` from each code to a rule on the subtotal, plus `couponDiscount(codes, subtotal)`. `computeTotal` gains the `coupons = []` option. There are 9 new tests in `test/cart.test.js`, and a Coupons section in `README.md`.

**Design choices and the principle behind each.**
- **Fix Root Causes.** I fixed the red test in `computeTotal` itself, not around it. The option's name and its only test both mean a percent, so the formula was wrong, not the test. It lands as its own commit first (**Sequence Work into Verifiable Units**), so the coupon commit starts from a passing suite.
- **Model the Domain.** Coupons are a `Map` in their own module, the same [...4920 more chars]
e117 [d2] says (interim): I'll re-read the principle leaves I plan to cite, and check whether summing cent-rounded lines can drift below 20 in floating point.

I should re-read the leaves I'm citing—model-the-domain, subtract-before-you-add, test-behavior, and laziness—since the instructions call for re-reading any leaf referenced. I'm also sketching out the coupon entry shape with a minimum subtotal and discount field, along with an error message for invalid coupon codes.

I'm settling on wording like "Coupon code 'FLAT5' needs a subtotal of at least 20.00. Add 7.50 more to use it," and working out the shortfall calculation with cent rounding to avoid floating-point issues like 20-19.99 producing a messy decimal. I'm also deciding to use the canonical coupon name in this message since a normalized key is clearer, while raw input is still needed for the unknown-code case since there's no canonical name to fall back on there—then checking that the subtotal comparison against the minimum also uses rounded cents to avoid float precision problems.

Since summing rounded line totals can still drift slightly due to floating point, I'm considering rounding the subtotal itself right at the source in the cart computation rather than just at comparison time, since that's a cleaner fix and directly matters for the edge case where a cart should total exactly 20.00. I want to verify whether such drift actually occurs with some sample values before deciding whether to add a dedicated test for it.


e118 [d2] run: cd <pstack> && for s in principle-model-the-domain principle-subtract-before-you-add principle-test-behavior-not-implementation principle-laziness-protocol principle-fix-root-causes; do echo "=== $s"; sed -n '5,200p' $s/SKILL.md; done; node -e "for (const xs of [[6.66,6.67,6.67],[6.67,6.67,6.66],[0.1,0.2,19.7],[19.7,0.2,0.1],[10.1,9.9]]) console.log(xs, xs.reduce((a,b)=>a+b,0)); console.log(20-19. [...13 more chars]
e119 [d2] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e120 [d2] read <pstack>/poteto-mode/principles/subtract-before-you-add.md (full)
e121 [d2] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e122 [d2] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e123 [d2] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e124 [d2] says (interim): Those sums landed exactly on 20. I'll brute-force two- and three-line carts whose cents add to 20.00, to see if any float sum comes out below 20.

I'm checking other pairs for floating point drift, wondering if any cent combinations summing to 20.00 produce rounding errors like 0.1+0.2 does.


e125 [d2] run: node -e "let n=0,ex;for(let a=1;a<2000;a++)for(let b=1;a+b<2000;b++){const c=2000-a-b;const s=a/100+b/100+c/100;if(s<20){n++;ex=ex||[a,b,c,s]}}console.log(n,ex)"
e126 [d2] says (interim): I see the floating-point issue: 0.02+16.08+3.90 actually evaluates to 19.999999999999996, which would incorrectly reject a valid $20 order. I'll fix this at the root by rounding the subtotal once inside computeTotal, and add a test covering that exact cart.


Found a real bug: rounding errors cause a subtotal of 19.999999999999996 instead of 20.00, incorrectly rejecting the order. I'll fix it by rounding once in `computeTotal` and add this cart as a test case.


e127 [d2] edit <repo>/src/coupons.js
e128 [d2] edit <repo>/src/cart.js
e129 [d2] edit <repo>/test/cart.test.js
e130 [d2] edit <repo>/README.md
e131 [d2] says (interim): Running the suite, then a check that the drift test fails when the subtotal rounding is removed.

The README's note about an order taking exactly one code and throwing on multiple or unknown ones looks fine. I should run the tests, then try a mutation test by removing the roundCents call on subtotal to confirm the drift test actually catches it.


e132 [d2] run: cd <repo> && npm test 2>&1; cp src/cart.js /tmp/cart.js && sed -i 's/roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0))/items.reduce((sum, item) => sum + lineTotal(item), 0)/' src/cart.js && npm test 2>&1 | rg "^(✖|ℹ (pass|fail))"; cp /tmp/cart.js src/cart.js && git diff --stat
e133 [d2] run: cd <repo> && git add -A && git commit -qm "require a 20 subtotal for FLAT5

Coupon entries become { minSubtotal, discount }. Below the minimum,
couponDiscount throws with the code, the minimum, and the shortfall
to two decimals. The Math.min(5, subtotal) cap is gone because the
subtotal is now at least 20.

computeTotal now rounds the subtotal to cents. Without that, lines of
0.02, 16.08 and 3.90  [...159 more chars]
e134 [d2] FINAL MESSAGE TO PARENT:
`FLAT5` now needs a subtotal of at least 20. Below that it throws an error that tells the customer how much more to add. All 16 tests pass, and the change is one commit on `main` (`5642422`), not pushed.

While testing, I found and fixed a bug the new minimum would have exposed. Some carts that add up to exactly 20.00 were summed as just under 20 because of floating-point error. Three lines of 0.02, 16.08, and 3.90 sum to `19.999999999999996`, so a real 20.00 order would be rejected with "Add 0.00 more". `computeTotal` now rounds the subtotal to cents once, before any coupon check. I found this case by checking every three-line cart whose cents add up to 20.00: 49,376 of them came out below 20. It's now a test, and that test fails if the subtotal rounding is removed.

**Error message format.**

```
Coupon code "<CODE>" needs a subtotal of at least <min>. Add <shortfall> more to use it.
```

- `<CODE>` is the code as looked up (trimmed and uppercased), so `"flat5"` is reported as `FLAT5`.
- `<min>` and `<shortfall>` are rounded to cents and always shown with two decimals.
- 19.99 gives `Add 0.01 more`, 12.50 gives `Add 7.50 more`, and an empty cart gives `Add 20.00 more`.
- Exactly 20 is accepted.

**Choices, and the principle behind each.**
- **Model the Domain.** The minimum lives in the registry data, with no `if (code === "FLAT5")`. Each entry is now `{ minSubtotal, discount }`. That's the smallest change that turns the minimum into data. One comparison in `couponDiscount` covers every code, and a future code with a minimum is a one-line entry. `SAVE10` gets `minSubtotal: 0`, so its behavior is unchanged and its tests are untouched.
- **Subtract Before You Add.** The `Math.min(5, subtotal)` cap is gone, because a subtotal of 20 or more can never go negative. `FLAT5`'s rule is now `() => 5`. I deleted the two tests that only covered the cap ("under 5" and "empty cart costs nothing").
- **Fix Root Causes.** The float problem is fixed where the subtotal is computed in `cart.js`. I didn't patch it with a tolerance in the coupon check. Every later step now sees a subtotal already rounded to cents.
- **Test Behavior, Not Implementation.** Each new test calls `computeTotal` and checks an exact total or an exact error message. They cover:
  - exactly 20;
  - three lines that add up to exactly 20;
  - 19.99;
  - 12.50, entered as lowercase `flat5`;
  - an empty cart.
- **Laziness Protocol.** The whole change is 4 files and a net +25 lines. There's no new module or helper, since the shortfall reuses `roundCents` and `toFixed`.

**Diff.**

```diff
--- a/src/coupons.js
+++ b/src/coupons.js
-import { percentOf } from "./money.js";
+import { percentOf, roundCents } from "./money.js";
 
 const COUPONS = new Map([
-  ["SAVE10", (subtotal) => percentOf(subtotal, 10)],
-  ["FLAT5", (subtotal) => Math.min(5, subtotal)],
+  ["SAVE10", { minSubtotal: 0, discount: (subtotal) => percentOf(subtotal, 10) }],
+  ["FLAT5", { minSubtotal: 20, discount: () => 5 }],
 ]);
@@ export function couponDiscount(codes, subtotal) {
-  const [code] = codes;
-  const rule = COUPONS.get(code.trim().toUpperCase());
-  if (!rule) throw new Error(`Unknown coupon code ${JSON.stringify(code)}`);
-  return rule(subtotal);
+  const code = codes[0].trim().toUpperCase();
+  const coupon = COUPONS.get(code);
+  if (!coupon) throw new Error(`Unknown coupon code ${JSON.stringify(codes[0])}`);
+  if (subtotal < coupon.minSubtotal) {
+    const shortfall = roundCents(coupon.minSubtotal - subtotal).toFixed(2);
+    throw new Error(
+      `Coupon code "${code}" needs a subtotal of at least ${coupon.minSubtotal.toFixed(2)}. Add ${shortfall} more to use it.`,
+    );
+  }
+  return coupon.discount(subtotal);
 }

--- a/src/cart.js
+++ b/src/cart.js
-  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
+  const subtotal = roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0));

--- a/README.md
+++ b/README.md
-- `FLAT5` takes 5 off the subtotal. It never takes the subtotal below 0.
+- `FLAT5` takes 5 off a subtotal of 20 or more. Below 20, `computeTotal` throws an error with the amount the customer still needs to add, for example `Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 7.50 more to use it.`

--- a/test/cart.test.js
+++ b/test/cart.test.js
-test("FLAT5 on a subtotal under 5 zeroes the subtotal but keeps shipping", () => {
-  assert.equal(computeTotal([{ price: 3, qty: 1 }], { coupons: ["FLAT5"] }), 5);
+test("FLAT5 is accepted at exactly 20", () => {
+  assert.equal(computeTotal([{ price: 20, qty: 1 }], { coupons: ["FLAT5"] }), 20);
 });
 
-test("FLAT5 on an empty cart costs nothing", () => {
-  assert.equal(computeTotal([], { coupons: ["FLAT5"] }), 0);
+test("FLAT5 is accepted when lines add up to exactly 20", () => {
+  const items = [{ price: 0.02, qty: 1 }, { price: 16.08, qty: 1 }, { price: 3.9, qty: 1 }];
+  assert.equal(computeTotal(items, { coupons: ["FLAT5"] }), 20);
+});
+
+test("FLAT5 just below 20 asks for one more cent", () => {
+  assert.throws(() => computeTotal([{ price: 19.99, qty: 1 }], { coupons: ["FLAT5"] }), {
+    message: 'Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 0.01 more to use it.',
+  });
+});
+
+test("FLAT5 below 20 names the shortfall", () => {
+  assert.throws(() => computeTotal([{ price: 2.5, qty: 5 }], { coupons: ["flat5"] }), {
+    message: 'Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 7.50 more to use it.',
+  });
+});
+
+test("FLAT5 on an empty cart asks for the full minimum", () => {
+  assert.throws(() => computeTotal([], { coupons: ["FLAT5"] }), {
+    message: 'Coupon code "FLAT5" needs a subtotal of at least 20.00. Add 20.00 more to use it.',
+  });
 });
```

**Full `npm test` output.**

```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (2.3611ms)
✔ rounds each line to cents (0.3116ms)
✔ applies a 10% discount before shipping (0.2947ms)
✔ an empty cart costs nothing (0.2477ms)
✔ SAVE10 takes 10% off the subtotal, not shipping (0.3504ms)
✔ SAVE10 rounds the discount to cents (0.2714ms)
✔ FLAT5 takes 5 off the subtotal, not shipping (0.3253ms)
✔ FLAT5 is accepted at exactly 20 (0.2439ms)
✔ FLAT5 is accepted when lines add up to exactly 20 (0.357ms)
✔ FLAT5 just below 20 asks for one more cent (1.1079ms)
✔ FLAT5 below 20 names the shortfall (0.3022ms)
✔ FLAT5 on an empty cart asks for the full minimum (0.1579ms)
✔ codes ignore case and surrounding whitespace (0.1134ms)
✔ the percentage discount applies after the coupon (0.1236ms)
✔ an unknown code is rejected by name (0.1471ms)
✔ a second code is rejected (0.281ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1965.9444
```

**Open decision.** The minimum is checked against the subtotal before the percentage discount and before shipping, as you asked. So a 20.00 cart with `discountPct: 10` still qualifies for `FLAT5`. If the minimum should apply to the price after that discount, the check has to move after the discount step in `computeTotal`, which changes the order in which the discount and coupon are applied.

I'm ready to write the reply now, keeping it natural and avoiding em dashes or mid-sentence colons.


--- end of delegate d2 ---

=== turn t2 ===
e135 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e136 [main] says (interim): I'll read the current code and tests fresh, as a reviewer would.
e137 [main] run: git show ff910e0 -- test src | head -80
e138 [main] run: cat src/cart.js src/coupons.js src/money.js src/shipping.js && cat test/cart.test.js && cat README.md && git diff ff910e0 --stat
e139 [main] says (interim): I've read all of it. Next I'm running the two cases I suspect are wrong, so the review rests on actual output.
e140 [main] run: node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
const items = [{ price: 20, qty: 2 }];
const tryIt = (label, f) => { try { console.log(label, "=>", f()); } catch (e) { console.log(label, "=> throws", e.constructor.name + ":", e.message); } };
tryIt("old caller discountPct: 0.1", () => computeTotal(items, { discountPct: 0.1 }));
tryIt("coupons: \"SAVE10\" (string)", () = [...394 more chars]
e141 [main] REPLY TO USER:
I'd block on two things. One is a silent change to how `discountPct` is read, which could break whoever already calls it. The other is that customer-facing errors can't be told apart from crashes. Everything else is a should-fix or a nit. I ran each case below against the code as it is now.

**Blockers.**

1. **`discountPct` quietly changed meaning.** The original code read it as a fraction, so `0.1` meant 10% off. The first commit (`729e8eb`) changed it to a percent. That matches the test, which had been failing on `main` since `ff910e0`. But any existing caller that passes `0.1` now gets 0.1% off without any error. On a 40.00 cart I measured 44.96 where they'd expect 41.00. Nothing in this repo shows who calls it, so it's impossible to tell which side was the mistake, the test or the code. Before this merges, check the checkout callers (or ask Dana, who wrote `ff910e0`). Then land the fix with a version bump from 0.3.0 and a note in the changelog. If callers really pass fractions, fix the test instead.

2. **The checkout screen can't tell a customer mistake from a bug.** All four coupon errors are plain `Error`s with English messages:
   - unknown code;
   - more than one code;
   - below the minimum;
   - a crash on bad input.

   To show "Add 7.50 more" to the customer, the screen would have to parse our message text. It also has no safe way to decide which errors to show at all. I'd want a `CouponError` with a `reason` (`unknown`, `multiple`, `below_minimum`), plus `code`, `minSubtotal` and `shortfall` as fields. The message can stay as it is. Tests should check `reason` and `shortfall`, not only the message string.

**Should fix before merge.**

3. **Bad input crashes instead of being rejected.** `coupons: "SAVE10"` throws `TypeError: codes.map is not a function`. `coupons: [null]` throws a `TypeError` about `.trim`. Passing a single string is the most likely caller mistake, because the rule is one code per order. Check the input where it enters `couponDiscount`. That could mean accepting a single string, or rejecting anything other than an array of strings with a clear error.

4. **The rules for combining discounts were never agreed.** A coupon stacks with `discountPct`, and the 20.00 minimum is checked before `discountPct`. So a 20.00 cart with `FLAT5` and 50% off comes to 12.50, which is 7.50 for the goods. You asked for the minimum because `FLAT5` loses money on small orders, and stacking makes that worse. Someone on the business side should confirm the order of steps, and there should be a test that pins down `FLAT5` together with `discountPct`.

**Nits.**

5. The two error messages show the code differently. "Unknown code" repeats exactly what was typed, while the minimum-subtotal error shows the cleaned-up code. Either is fine, but pick one.
6. The error messages include the customer's raw input. `JSON.stringify` doesn't escape HTML, so the screen must display the message as plain text. That's worth one line in the README.
7. `discountPct` isn't checked. A value of 150 gives a total of -15. This was already true before this work, but the change touches that line, so a simple 0 to 100 check is cheap.
8. Money is stored as floating-point numbers. The subtotal rounding fixes the one failure that turned up, but integer cents would rule out that whole class of bug. That's for a follow-up, not a blocker.

**What's good.** The coupon list lives in one place, and each coupon's data includes its minimum. The float fix at exactly 20.00 is real, and there's a test for it. Every test checks an exact value through `computeTotal`, and the commits are small and in a sensible order.

I can fix points 2, 3, 5 and 7 now. Points 1 and 4 need an answer from you or the owner of the checkout code.No follow-up is needed. That notification was the file read my review was based on, and nothing in it changes the review. The next step is still your call. I can fix the error types, the input checks, the message consistency and the `discountPct` range check now. What `discountPct` means for existing callers, and the order in which discounts combine, both need an answer from you or the owner of the checkout code.
