=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] run: git ls-files && cat package.json 2>/dev/null; for f in $(git ls-files | grep -v lock); do echo "=== $f"; cat "$f"; done | head -400
e3 [main] read <pstack>/poteto-mode/playbooks/feature.md (full)
e4 [main] run: npm test 2>&1 | tail -30; git log -p --stat -3 | head -120
e5 [main] other tool call
e6 [main] task list create: [todo] 1. `how` over the affected subsystem.
e7 [main] task list create: [todo] 2. `architect` for parallel design exploration. Skipping stays as `architect skipped: <reason>`. Do not fold the design decision silently into implementation.
e8 [main] task list create: [todo] 3. Write the throughput checkpoint as four lines in the step list.
e9 [main] task list create: [todo] 4. Delegate code-writing to a subagent using your configured feature model (default `sonnet`) with a specific scope. Review its diff yourself.
e10 [main] task list create: [todo] 5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
e11 [main] task list create: [todo] 6. Rebase into small, ordered commits. Stack follow-ups.
e12 [main] task list create: [todo] 7. If the design is contested, `interrogate` before shipping.
e13 [main] task list create: [todo] 8. Run **Opening a PR**.
e14 [main] task list update: [doing] 1
e15 [main] run: npm test 2>&1 | tail -30; git log -p -3 | head -150; git remote -v
e16 [main] read <pstack>/how/SKILL.md (full)
e17 [main] run: cd <pstack> && cat architect/SKILL.md; for p in model-the-domain redesign-from-first-principles boundary-discipline test-behavior-not-implementation prove-it-works laziness-protocol fix-root-causes; do echo "=== $p"; cat poteto-mode/principles/$p.md; done
e18 [main] read <pstack>/architect/SKILL.md (full)
e19 [main] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e20 [main] read <pstack>/poteto-mode/principles/redesign-from-first-principles.md (full)
e21 [main] read <pstack>/poteto-mode/principles/boundary-discipline.md (full)
e22 [main] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e23 [main] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e24 [main] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e25 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e26 [main] says (interim): Short update. I've read the whole cart module and its history, and found one test already failing on `main`. Next I'm writing the design, then handing the implementation to a subagent.
e27 [main] task list update: [done] 1. `how` over the affected subsystem. skip: whole subsystem is 3 source files (16 lines) plus 3 commits, read directly in full
e28 [main] task list update: [done] 2. architect skipped: one lookup table plus one option on computeTotal, no second whole-shape alternative worth a runner; sketch written inline in step 4 scope
e29 [main] task list update: [done] 3
e30 [main] task list update: [doing] 4
e31 [main] spawn poteto-agent delegate, model tier mid, foreground. Brief: Repo: <repo> (Node ESM, `npm test` runs `node --test`). Own this diff directly; do not spawn further agents. Do not commit; leave changes in the working tree. Read src/cart.js, src/money.js, src/shipping.js, test/cart.test.js first.

Context: `computeTotal(items, { discountPct })` is currently broken. The test passes `discountPct: 10` expecting 10% off, the code does `subtotal * (1 - discountPct)`, so the test fails (-355 !== 41). Its only caller is that test. We are replacing `discountPct` with coupon codes entirely (coupons are the one discount mechanism; keeping both would allow stacking, which "one code per order" forbids).

Requirement: SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal. One code per order. Unknown code rejected with a clear error.

Data shape (implemen [...2007 more chars]
e32 [main] says (interim): The implementation subagent is running now. I'll review its diff once it reports back.
e33 [main] read <pstack>/unslop/SKILL.md (full)
e34 [main] says (interim): A subagent is writing the coupon code in `src/cart.js` and its tests in `test/cart.test.js` right now. Nothing is finished or committed yet. When it reports back I'll read its diff and run `npm test` myself before calling anything done.

**Already broken on `main`.** Before any change, `npm test` fails one of four tests. "applies a 10% discount before shipping" returns -355 where it expects 41. The test passes `discountPct: 10`, but the code treats that number as a fraction and computes `subtotal * (1 - 10)`.

**Design I gave the subagent.**
- `computeTotal(items, { coupon })` takes a single optional code string. Because there's room for only one code, "one code per order" holds without a separate check.
- A lookup table maps each code to its discount. SAVE10 is 10% of the subtotal, rounded to cents. FLAT5 is 5, but never more than the subtotal. Adding a code means adding one row, with no if/else to extend.
- An unknown code throws `Unknown coupon code "BOGUS"`.
- Codes ignore case and surrounding spaces, so " save10 " works.
- Coupons reduce the subtotal only. Shipping is still charged.

**`discountPct` goes away.** Coupons replace it, and its only caller is that broken test. That test becomes the SAVE10 case, with the same cart and the same expected 41. Keeping both options would let a caller stack two discounts on one order.

**Why these choices.**
- **principle-model-the-domain** is why the codes live in a table instead of branches.
- **principle-redesign-from-first-princ [...918 more chars]
e35 [main] run: git diff --stat && npm test 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail))"; node -e 'import("./src/cart.js").then(m=>{for (const c of [undefined,"SAVE10","flat5","",  "SAVE10,FLAT5"]) { try { console.log(JSON.stringify(c), m.computeTotal([{price:20,qty:2}],{coupon:c})) } catch(e){ console.log(JSON.stringify(c), "throws:", e.message) } }})'; cat ~/.claude/skills/deslop/SKILL.md ~/.claude/skills/no-comments/ [...19 more chars]
e36 [main] read ~/.claude/skills/deslop/SKILL.md (partial)
e37 [main] read ~/.claude/skills/no-comments/SKILL.md (partial)
e38 [main] run: git switch -c coupon-codes && git add -A && git commit -q -F - <<'EOF'
Replace discountPct with SAVE10 and FLAT5 coupon codes

computeTotal now takes a single optional coupon code. SAVE10 takes 10%
off the subtotal, rounded to cents. FLAT5 takes 5 off the subtotal and
never drops it below zero. Shipping is always charged in full. Codes
ignore case and surrounding whitespace. An unknown code throws [...379 more chars]
e39 [main] run: git switch -c coupon-codes && git add -A && git commit -q -F - <<'EOF'
Replace discountPct with SAVE10 and FLAT5 coupon codes

computeTotal now takes a single optional coupon code. SAVE10 takes 10%
off the subtotal, rounded to cents. FLAT5 takes 5 off the subtotal and
never drops it below zero. Shipping is always charged in full. Codes
ignore case and surrounding whitespace. An unknown code throws [...379 more chars]
e40 [main] run: git show --stat HEAD | tail -5; git status --short
e41 [main] task list update: [done] 4
e42 [main] task list update: [done] 5
e43 [main] task list update: [done] 6. Rebase into small, ordered commits. Stack follow-ups. One commit ac0f4fe on branch coupon-codes; the fix and feature are one unit since the broken test becomes the SAVE10 test.
e44 [main] task list update: [done] 7. If the design is contested, `interrogate` before shipping. skip: not contested; the open calls are product preferences for the user.
e45 [main] task list update: [done] 8. Run **Opening a PR**. skip: repo has no git remote, so there's nowhere to open one.
e46 [main] REPLY TO USER:
The cart now accepts coupon codes. Checkout passes `computeTotal(items, { coupon: "SAVE10" })`, and any code other than SAVE10 or FLAT5 throws `Unknown coupon code "BOGUS"`. The work is one commit, `ac0f4fe`, on the local branch `coupon-codes`. There's no PR because the repo has no git remote. All 9 tests pass.

**Shape.** `computeTotal` takes one optional `coupon` string. A private `COUPONS` table in `src/cart.js` maps each code to a function that turns the subtotal into a discount.

**How it behaves.** These results come from calling the function directly on a 40.00 cart, which adds 5 for shipping.
- No coupon gives 45.
- `"SAVE10"` gives 41. The discount is 10% of the subtotal, rounded to cents.
- `"flat5"` gives 40. Codes ignore case and surrounding spaces.
- FLAT5 on a 3.00 cart gives 5. The subtotal drops to 0 and shipping is still charged.
- `""` and `"SAVE10,FLAT5"` both throw `Unknown coupon code`.

**One test was already failing on `main`.** "applies a 10% discount before shipping" returned -355 instead of 41. The test passed `discountPct: 10` for 10%, but the code treated the number as a fraction. I removed `discountPct`, and that test now checks SAVE10 with the same cart and the same 41. Keeping both options would have let one order take two discounts.

**What changed my choices.**
- principle-model-the-domain is why the codes live in a lookup table instead of an if/else. A new code is one new line in `COUPONS`.
- principle-redesign-from-first-principles is why coupons replaced `discountPct` instead of sitting next to it.
- principle-boundary-discipline is why the code is trimmed and uppercased once, where the user's text comes in.
- principle-test-behavior-not-implementation is why all six new tests call `computeTotal` and check an exact total or error message. That includes a rounding case, where 7.77 with SAVE10 gives 11.99.
- principle-laziness-protocol is why I kept the one nested `if` instead of adding a helper function with a single caller.

**Work split.** A subagent wrote the code and tests from my spec. I reviewed its diff, reran `npm test` after the commit, and ran the direct calls listed above. I didn't run the separate `how` and `architect` design steps because the whole module is 16 lines, and I read all of it and its history myself. No part of the design is contested enough for an adversarial review.

**Decisions for you.**
- **Removing `discountPct`.** Any caller outside this repo that still passes it will silently get no discount.
- **Empty coupon field.** `coupon: ""` throws right now. If checkout sends an empty string when the field is left blank, either checkout should send `undefined` or `computeTotal` should treat a blank code as no coupon. I'd lean toward the second.
- **FLAT5 on carts under 5.** It's accepted and brings the subtotal to 0. You might want a minimum order for FLAT5 instead.

--- delegate d1 (poteto-agent, spawned at e31) ---
e47 [d1] BRIEF RECEIVED: Repo: <repo> (Node ESM, `npm test` runs `node --test`). Own this diff directly; do not spawn further agents. Do not commit; leave changes in the working tree. Read src/cart.js, src/money.js, src/shipping.js, test/cart.test.js first.

Context: `computeTotal(items, { discountPct })` is currently broken. The test passes `discountPct: 10` expecting 10% off, the code does `subtotal * (1 - discountPct)`, so the test fails (-355 !== 41). Its only caller is that test. We are replacing `discountPct` with coupon codes entirely (coupons are the one discount mechanism; keeping both would allow stacking, which "one code per order" forbids).

Requirement: SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal. One code per order. Unknown code rejected with a clear error.

Data shape (implemen [...2007 more chars]
e48 [d1] read <pstack>/poteto-mode/SKILL.md (full)
e49 [d1] read <repo>/src/cart.js (full)
e50 [d1] read <repo>/src/money.js (full)
e51 [d1] read <repo>/src/shipping.js (full)
e52 [d1] read <repo>/test/cart.test.js (full)
e53 [d1] read <repo>/README.md (full)
e54 [d1] read <pstack>/poteto-mode/playbooks/feature.md (full)
e55 [d1] says (interim): Task list for this Feature-shaped change, adapted since the caller fixed the shape and forbade sub-delegation:

1. `how` over the affected subsystem — skip: shape and file boundaries (cart.js, money.js, shipping.js, test file) were already fully specified by the caller; nothing to explore.
2. `architect` for parallel design exploration — architect skipped: the caller dictated the exact data shape (COUPONS lookup table, signature, error format), leaving no open design fork to explore.
3. Throughput checkpoint: n/a (single file pair, no fan-out) — this is a single-owner, single-file-pair edit (cart.js + its test), too small to parallelize.
4. Delegate code-writing to a subagent — skip: the caller explicitly instructed "do not spawn further agents; own this diff directly." I satisfy the review-separation intent by writing then independently re-reading my own diff before reporting.
5. Verify on the matching surface (npm test) — in progress below.
6. Rebase into small commits — skip: caller said "do not commit; leave changes in the working tree."
7. `interrogate` if contested — skip: shape was prescribed, not contested.
8. Opening a PR — skip: no commit/PR requested; deliverable is the working-tree diff.

Now implementing.
e56 [d1] edit <repo>/src/cart.js
e57 [d1] run: cd <repo> && node -e "
const roundCents = (a) => Math.round(a*100)/100;
const subtotal = roundCents(7.77*1);
console.log('subtotal', subtotal);
const discount = roundCents(subtotal*0.1);
console.log('discount', discount);
console.log('total', roundCents(subtotal - discount + 5));
"

e58 [d1] edit <repo>/test/cart.test.js
e59 [d1] edit <repo>/README.md
e60 [d1] read <pstack>/technical-writing/SKILL.md (full)
e61 [d1] read <pstack>/unslop/SKILL.md (full)
e62 [d1] says (interim): My README bullet is a reference-mode sentence describing what the file does, matching the existing style ("`src/cart.js` computes..."), plain words, no colon-list tell, active voice. Retrying the edit.
e63 [d1] edit <repo>/README.md
e64 [d1] says (interim): Now run tests and self-review the diff.
e65 [d1] run: cd <repo> && npm test 2>&1
e66 [d1] run: cd <repo> && git diff
e67 [d1] says (interim): All 9 tests pass, no if/else or switch on code names (a single `if (!discountFor)` guards the unknown-code case, not a branch on names), nothing committed, working tree left as-is per your instructions.

**Shape.** `COUPONS` is a lookup table keyed by normalized code, each value a pure function `subtotal -> discount`. `computeTotal(items, { coupon } = {})` looks the code up once; adding a new coupon means adding one table entry, never touching `computeTotal`'s control flow. That is **principle-model-the-domain**: a registry replaces what would otherwise become an if/switch on code names.

Principles applied: **principle-model-the-domain** shaped the COUPONS table decision above. **principle-laziness-protocol** kept the change to the minimum: no new coupon-parsing module, no class, `discount = 0` as the plain no-coupon default rather than a null-object pattern. **principle-test-behavior-not-implementation** shaped the tests, each calls `computeTotal` the way checkout would and asserts a literal number, including the sub-cent rounding case computed by hand and checked with a one-line why comment.

Files touched, all absolute paths:
- `<repo>/src/cart.js`, `discountPct` removed, `COUPONS` table added (not exported), `computeTotal` now takes `{ coupon }`.
- `<repo>/test/cart.test.js`, the broken discount test replaced with the six coupon tests requested.
- `<repo>/README.md`, the `src/cart.js` bullet now mentions coupon codes.

`npm test` output, verbatim, above: 9 pass, 0 fail.  [...651 more chars]
e68 [d1] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e69 [d1] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e70 [d1] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e71 [d1] read <pstack>/poteto-mode/principles/never-block-on-the-human.md (full)
e72 [d1] FINAL MESSAGE TO PARENT:
All 9 tests pass, no if/else or switch on code names (a single `if (!discountFor)` guards the unknown-code case), nothing committed, working tree left as-is per instructions.

**Shape.** `COUPONS` is a lookup table keyed by normalized code, each value a pure function `subtotal -> discount`. `computeTotal(items, { coupon } = {})` looks the code up once. That is principle-model-the-domain, read in full: a registry replaces what would otherwise become a branch that grows with every new coupon.

Principles applied, each read in full this turn:

Principle-model-the-domain shaped the COUPONS table decision, a map keyed by code instead of an if/else chain that would grow with each new coupon.

Principle-laziness-protocol shaped keeping the change to the minimum diff: no new coupon-parsing module, no class, `discount = 0` as the plain no-coupon default instead of a null-object pattern, and reusing the existing `roundCents` rather than adding a rounding helper.

Principle-test-behavior-not-implementation shaped the six new tests. Each calls `computeTotal` the way checkout would and asserts a literal number it would still fail to produce if `COUPONS`, `roundCents`, or the coupon lookup returned `undefined`, including the sub-cent rounding case computed by hand with a one-line why comment, and the `assert.throws` check against the literal error message rather than just checking that it throws.

Principle-never-block-on-the-human shaped the decision on `coupon: undefined` versus `coupon: ""`. The spec only requires rejecting an unknown supplied code, not defining behavior for omission, so I made the reasonable call (skip the lookup entirely when `coupon` is `undefined`) and proceeded rather than pausing to ask, noting the residual edge case below for review.

Files touched, all absolute paths:
- `<repo>/src/cart.js`, `discountPct` removed, `COUPONS` table added (not exported), `computeTotal` now takes `{ coupon }`.
- `<repo>/test/cart.test.js`, the broken discount test replaced with the six coupon tests requested.
- `<repo>/README.md`, the `src/cart.js` bullet now mentions coupon codes.

`npm test` output, verbatim:
```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (2.0309ms)
✔ rounds each line to cents (0.1726ms)
✔ SAVE10 takes 10% off the subtotal before shipping (0.1628ms)
✔ FLAT5 takes 5 off the subtotal before shipping (0.1551ms)
✔ SAVE10 rounds the discount to cents (0.1544ms)
✔ FLAT5 never takes the subtotal below zero (0.1111ms)
✔ coupon codes are case and whitespace insensitive (0.134ms)
✔ rejects an unknown coupon code (0.785ms)
✔ an empty cart costs nothing (0.1826ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 116.9683
```

`git diff` output, verbatim:
```
diff --git a/README.md b/README.md
index 509af54..e57226d 100644
--- a/README.md
+++ b/README.md
@@ -2,6 +2,6 @@
 
 Cart pricing for the shop checkout. `npm test` runs the suite.
 
-- `src/cart.js` computes line totals and the cart total.
+- `src/cart.js` computes line totals and the cart total, applying an optional coupon code (SAVE10, FLAT5).
 - `src/money.js` rounds to cents.
 - `src/shipping.js` charges flat shipping.
diff --git a/src/cart.js b/src/cart.js
index 38361b4..b1658a5 100644
--- a/src/cart.js
+++ b/src/cart.js
@@ -5,8 +5,21 @@ export function lineTotal(item) {
   return roundCents(item.price * item.qty);
 }
 
-export function computeTotal(items, { discountPct = 0 } = {}) {
+const COUPONS = {
+  SAVE10: (subtotal) => roundCents(subtotal * 0.1),
+  FLAT5: (subtotal) => Math.min(5, subtotal),
+};
+
+export function computeTotal(items, { coupon } = {}) {
   const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
-  const discounted = subtotal * (1 - discountPct);
-  return roundCents(discounted + shippingFor(items));
+  let discount = 0;
+  if (coupon !== undefined) {
+    const code = coupon.trim().toUpperCase();
+    const discountFor = COUPONS[code];
+    if (!discountFor) {
+      throw new Error(`Unknown coupon code "${coupon}"`);
+    }
+    discount = discountFor(subtotal);
+  }
+  return roundCents(subtotal - discount + shippingFor(items));
 }
diff --git a/test/cart.test.js b/test/cart.test.js
index 7bcbf17..8352557 100644
--- a/test/cart.test.js
+++ b/test/cart.test.js
@@ -10,8 +10,32 @@ test("rounds each line to cents", () => {
   assert.equal(lineTotal({ price: 0.333, qty: 3 }), 1);
 });
 
-test("applies a 10% discount before shipping", () => {
-  assert.equal(computeTotal([{ price: 20, qty: 2 }], { discountPct: 10 }), 41);
+test("SAVE10 takes 10% off the subtotal before shipping", () => {
+  assert.equal(computeTotal([{ price: 20, qty: 2 }], { coupon: "SAVE10" }), 41);
+});
+
+test("FLAT5 takes 5 off the subtotal before shipping", () => {
+  assert.equal(computeTotal([{ price: 20, qty: 2 }], { coupon: "FLAT5" }), 40);
+});
+
+test("SAVE10 rounds the discount to cents", () => {
+  // subtotal 7.77 * 10% = 0.777, which rounds up to 0.78
+  assert.equal(computeTotal([{ price: 7.77, qty: 1 }], { coupon: "SAVE10" }), 11.99);
+});
+
+test("FLAT5 never takes the subtotal below zero", () => {
+  assert.equal(computeTotal([{ price: 3, qty: 1 }], { coupon: "FLAT5" }), 5);
+});
+
+test("coupon codes are case and whitespace insensitive", () => {
+  assert.equal(computeTotal([{ price: 20, qty: 2 }], { coupon: " save10 " }), 41);
+});
+
+test("rejects an unknown coupon code", () => {
+  assert.throws(
+    () => computeTotal([{ price: 20, qty: 2 }], { coupon: "BOGUS" }),
+    { message: 'Unknown coupon code "BOGUS"' },
+  );
 });
 
 test("an empty cart costs nothing", () => {
```

Open decision, not blocked on: when `coupon` is `undefined` I skip the lookup instead of routing an empty string through `COUPONS[""]`, since the caller only names "unknown code" for a supplied bad code, not for omission. An explicit `coupon: ""` would fall into the throw path with message `Unknown coupon code ""`, an outcome no test exercises; nothing in the spec calls that case out, so it stayed as is per the reasonable-default rule above, ready for course correction if checkout ever passes an empty string on purpose.
--- end of delegate d1 ---

=== turn t1 ===
e73 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e74 [main] task list create: [todo] 1. `how` over the affected subsystem.
e75 [main] task list create: [todo] 2. `architect` for parallel design exploration. Skipping stays as `architect skipped: <reason>`. Do not fold the design decision silently into implementation.
e76 [main] task list create: [todo] 3. Write the throughput checkpoint as four lines in the step list.
e77 [main] task list create: [todo] 4. Delegate code-writing to a subagent using your configured feature model (default `sonnet`) with a specific scope. Review its diff yourself.
e78 [main] task list create: [todo] 5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
e79 [main] task list create: [todo] 6. Rebase into small, ordered commits. Stack follow-ups.
e80 [main] task list create: [todo] 7. If the design is contested, `interrogate` before shipping.
e81 [main] task list create: [todo] 8. Run **Opening a PR**.
e82 [main] task list update: [done] 1. `how` over the affected subsystem. skip: I wrote and reviewed the whole coupon path last turn; src/cart.js is 25 lines
e83 [main] task list update: [done] 2. architect skipped: the change is one new column (minSubtotal) in the existing COUPONS table, no competing whole shape
e84 [main] task list update: [done] 11
e85 [main] task list update: [doing] 12
e86 [main] run: git status --short && git branch --show-current && cat src/cart.js
e87 [main] says (interim): Next I'm handing the minimum-subtotal rule to a subagent, working from a fixed spec.
e88 [main] spawn poteto-agent delegate, model tier mid, foreground. Brief: Repo: <repo>, branch coupon-codes (Node ESM, `npm test` runs `node --test`). Own this diff directly; do not spawn agents. Do not commit. Read src/cart.js and test/cart.test.js first.

Requirement: FLAT5 is only accepted when the subtotal is at least 20. Below that, reject it with an error telling the customer how much more they need to add. SAVE10 has no minimum.

Data shape (implement exactly this). Each COUPONS entry becomes an object with a minimum and a discount function, so eligibility is data, not a branch on the code name:
  const COUPONS = {
    SAVE10: { minSubtotal: 0, discount: (subtotal) => roundCents(subtotal * 0.1) },
    FLAT5: { minSubtotal: 20, discount: () => 5 },
  };
FLAT5's `Math.min(5, subtotal)` clamp goes away because it can no longer apply once the subtotal is at l [...1067 more chars]
e89 [main] says (interim): A subagent is adding the FLAT5 minimum now. When it finishes I'll review its diff and run the tests myself before committing.

**The rule I specified.** Each coupon in the table now has a minimum subtotal next to its discount. FLAT5's minimum is 20 and SAVE10's is 0. A subtotal of exactly 20 qualifies. Below 20, checkout gets this error, worked out by hand for a 12.50 subtotal:

`FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it.`

The amount still needed is rounded to cents, so a 19.99 cart says "Add 0.01 more" instead of showing leftover rounding digits.

**Why this shape.** Per principle-model-the-domain, the minimum is a value stored with each coupon, not an `if` on the name FLAT5. The next coupon with a threshold is one number in the table. With a minimum of 20, FLAT5 can no longer push the subtotal below zero, so the old safeguard for that goes away along with its test.

**Open decision.** The error message only has plain numbers, like "20.00", because the cart code has no currency anywhere. If the storefront should show "$7.50", checkout needs to add the symbol, or the cart needs to learn the currency.
e90 [main] says (interim): I'm reviewing the subagent's diff now. It reads correctly, but I want to test one float case myself: a cart whose prices add up to exactly 20.00 but whose floating-point sum lands just under 20.
e91 [main] run: git status --short && node -e '
import("./src/cart.js").then(m=>{
  let found=[];
  for (let a=1;a<2000 && found.length<3;a++) for (let b=1;b<2000-a && found.length<3;b++){ const c=2000-a-b; if(c<1) continue;
    const items=[{price:a/100,qty:1},{price:b/100,qty:1},{price:c/100,qty:1}];
    try { m.computeTotal(items,{coupon:"FLAT5"}) } catch(e){ found.push([a/100,b/100,c/100,e.message]) } }
  con [...20 more chars]
e92 [main] edit <repo>/test/cart.test.js
e93 [main] run: npm test 2>&1 | grep -E "^(✔|✖)|ℹ (pass|fail)|needs a subtotal" | head -20
e94 [main] edit <repo>/test/cart.test.js
e95 [main] run: npm test 2>&1 | grep -E "^✖|ℹ (pass|fail)|Add 0.00" | head -8
e96 [main] edit <repo>/src/cart.js
e97 [main] says (interim): That test fails as expected, showing "Add 0.00 more". I'm sending the one-line fix back to a fresh subagent.
e98 [main] spawn poteto-agent delegate, model tier mid, foreground. Brief: Repo: <repo>, branch coupon-codes, uncommitted changes present (keep them). Own this diff directly; do not spawn agents; do not commit.

Bug: test "FLAT5 is accepted when lines add up to exactly the minimum" in test/cart.test.js fails with "FLAT5 needs a subtotal of at least 20.00. Add 0.00 more to use it." Lines 0.02 + 16.08 + 3.90 sum in floating point to just under 20, so `subtotal < minSubtotal` is true.

Root-cause fix, exactly one change in src/cart.js computeTotal: round the subtotal once where it is computed:
  const subtotal = roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0));
Do not add epsilon comparisons or any other guard. Do not touch the tests. Change nothing else.

Success: `npm test` all 12 pass. Report `npm test` output and `git diff src/cart.js` verbatim.
e99 [main] says (interim): The FLAT5 minimum is written. While reviewing it I found a floating-point bug, and a subagent is fixing it now. Nothing from this change is committed yet.

**The rule.** FLAT5 needs a subtotal of at least 20, and exactly 20 counts. SAVE10 has no minimum. The subagent's diff gives each coupon in the table a `minSubtotal` next to its `discount`, so the code never checks for the name FLAT5. Its tests passed 11 of 11. A 12.50 cart with FLAT5 now fails with this message:

`FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it.`

**The bug.** I checked by brute force every three-item cart that adds up to exactly 20.00. Some of them are wrongly rejected. For example, 0.02 + 16.08 + 3.90 fails with "Add 0.00 more to use it." Each line is rounded to cents, but the subtotal is a floating-point sum that lands just under 20. I added a test for that cart, and it fails with that exact error.

**The fix.** Round the subtotal to cents once, where it's calculated. Per principle-fix-root-causes, the subtotal gets corrected at its source instead of the 20 comparison getting a tolerance. Lines are still rounded one by one first, which keeps the line-by-line rounding finance asked for in FIN-212. This also affects SAVE10, since its 10% now comes from the rounded subtotal.

**Next.** When the subagent finishes, I'll read its diff and rerun all 12 tests. I'll also rerun the brute-force check to confirm no cart totalling exactly 20.00 is rejected, then commit on `coupon-codes`.

**Open d [...167 more chars]
e100 [main] says (interim): The FLAT5 minimum is written. While reviewing it I found a floating-point bug, and a subagent is fixing it now. Nothing from this change is committed yet.

**Shape.** Each entry in the `COUPONS` table is now `{ minSubtotal, discount }`, keyed by the uppercased code. FLAT5 has a `minSubtotal` of 20 and SAVE10 has 0. The subtotal becomes a number rounded to cents, the sum of lines that are each rounded to cents.

**The rule.** FLAT5 needs a subtotal of at least 20, and exactly 20 counts. SAVE10 has no minimum. The code never checks for the name FLAT5, because the minimum is stored in the table (per principle-model-the-domain). The subagent's run passed 11 of 11 tests. A 12.50 cart with FLAT5 now fails with this message:

`FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it.`

**The bug.** I checked by brute force every three-item cart that adds up to exactly 20.00. Some of them are wrongly rejected. For example, 0.02 + 16.08 + 3.90 fails with "Add 0.00 more to use it." Each line is rounded to cents, but the subtotal is a floating-point sum that lands just under 20. I added a test for that cart, and it fails with that exact error:

```
✖ FLAT5 is accepted when lines add up to exactly the minimum (0.3165ms)
  Error: FLAT5 needs a subtotal of at least 20.00. Add 0.00 more to use it.
```

**The fix.** Round the subtotal to cents once, where it's calculated. Per principle-fix-root-causes, the subtotal gets corrected at its source instead of the 20 comparison getting a  [...564 more chars]
e101 [main] says (interim): The fix is back. Now I'm checking it myself with the full test suite, the complete diff, and a brute-force search over every cart that totals exactly 20.00.
e102 [main] run: git diff src/cart.js && npm test 2>&1 | grep -E "^✖|ℹ (pass|fail)" && node -e '
import("./src/cart.js").then(m=>{
  let checked=0, rejected=0, first=null;
  for (let a=1;a<2000;a++) for (let b=1;a+b<2000;b++){ const c=2000-a-b;
    checked++;
    try { m.computeTotal([{price:a/100,qty:1},{price:b/100,qty:1},{price:c/100,qty:1}],{coupon:"FLAT5"}) } catch(e){ rejected++; first ??= [a,b,c,e.message]  [...358 more chars]
e103 [main] run: git add -A && git commit -q -F - <<'EOF'
Require a 20 subtotal for FLAT5

FLAT5 was losing money on small orders. Each coupon now carries a
minimum subtotal next to its discount. FLAT5 needs at least 20, SAVE10
has none. Below the minimum the error names the shortfall, for example
"FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it."

The subtotal is now rounded to cents once after  [...276 more chars]
e104 [main] run: git add -A && git commit -q -F - <<'EOF'
Require a 20 subtotal for FLAT5

FLAT5 was losing money on small orders. Each coupon now carries a
minimum subtotal next to its discount. FLAT5 needs at least 20, SAVE10
has none. Below the minimum the error names the shortfall, for example
"FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it."

The subtotal is now rounded to cents once after  [...276 more chars]
e105 [main] task list update: [done] 12
e106 [main] task list update: [done] 13
e107 [main] task list update: [done] 6. Rebase into small, ordered commits. Stack follow-ups. One commit 88927fe stacked on ac0f4fe; the rounding fix ships with the minimum because the minimum's test fails without it.
e108 [main] task list update: [done] 7. If the design is contested, `interrogate` before shipping. skip: not contested, one table column plus a rounding fix proven by brute force.
e109 [main] task list update: [done] 8. Run **Opening a PR**. skip: repo has no git remote.
e110 [main] says (interim): FLAT5 now needs a subtotal of at least 20, and exactly 20 counts. Below that, checkout gets an error telling the customer how much more to add. SAVE10 has no minimum. It's committed as `88927fe` on the local branch `coupon-codes`, on top of the coupon commit. All 12 tests pass.

A 12.50 cart with FLAT5 gets this error:

`FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it.`

**Shape.** Each coupon in the `COUPONS` table is now `{ minSubtotal, discount }`, keyed by the uppercased code. FLAT5's minimum is 20 and SAVE10's is 0. The subtotal is now rounded to cents after summing lines that are each rounded to cents.

**A rounding bug I fixed along the way.** Reviewing the first version, I tried every three-item cart that adds up to exactly 20.00. Some were wrongly rejected. For example, 0.02 + 16.08 + 3.90 came back with "Add 0.00 more to use it", because the floating-point sum landed just under 20. A test for that cart failed with that exact error before the fix and passes after it. The fix rounds the subtotal once, where it's calculated. Lines are still rounded one by one first, which keeps the line-by-line rounding finance asked for in FIN-212.

**Verification.**
- `npm test` passes 12 of 12.
- FLAT5 rejected none of the 1,997,001 three-item carts that total exactly 20.00.
- Every single-item cart from 0.01 to 19.99 was rejected, 1,999 in all, and each error named the right amount to add.
- I reran these checks myself on the subagent's code, not on its report.

* [...1340 more chars]
e111 [main] other tool call
e112 [main] run: git status --short && git log --oneline -1 && (tasklist //FI "IMAGENAME eq node.exe" 2>/dev/null | tail -n +3 || true)
e113 [main] REPLY TO USER:
Nothing is still running on my side. Both subagents have finished, the working tree is clean, and `88927fe` is the latest commit. Several `node.exe` processes are running on the machine. I couldn't tell which program started them, so I left them alone.

FLAT5 now needs a subtotal of at least 20, and exactly 20 counts. Below that, checkout gets an error telling the customer how much more to add. SAVE10 has no minimum. It's committed as `88927fe` on the local branch `coupon-codes`, on top of the coupon commit. All 12 tests pass.

A 12.50 cart with FLAT5 gets this error:

`FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it.`

**Shape.** Each coupon in the `COUPONS` table is now `{ minSubtotal, discount }`, keyed by the uppercased code. FLAT5's minimum is 20 and SAVE10's is 0. The subtotal is now rounded to cents after summing lines that are each rounded to cents.

**A rounding bug I fixed along the way.** Reviewing the first version, I tried every three-item cart that adds up to exactly 20.00. Some were wrongly rejected. For example, 0.02 + 16.08 + 3.90 came back with "Add 0.00 more to use it", because the floating-point sum landed just under 20. A test for that cart failed with that exact error before the fix and passes after it. The fix rounds the subtotal once, where it's calculated. Lines are still rounded one by one first, which keeps the line-by-line rounding finance asked for in FIN-212.

**Verification.**
- `npm test` passes 12 of 12.
- FLAT5 rejected none of the 1,997,001 three-item carts that total exactly 20.00.
- Every single-item cart from 0.01 to 19.99 was rejected, 1,999 in all, and each error named the right amount to add.
- I reran these checks myself on the subagent's code, not on its report.

**What changed my choices.**
- principle-model-the-domain is why the minimum is a value stored with each coupon, not an `if` on the name FLAT5. Another coupon with a threshold is one number in the table. With the minimum at 20, FLAT5 can't push the subtotal below zero, so the old safeguard and its test are gone.
- principle-fix-root-causes is why I rounded the subtotal where it's calculated instead of adding a tolerance to the comparison with 20.
- principle-prove-it-works is why I ran the brute-force check myself instead of trusting a few chosen examples.

**Behavior change.** SAVE10 now takes its 10% from the rounded subtotal. The brute-force runs only checked FLAT5, so I haven't measured whether any SAVE10 total moved. I'd expect a cent of difference at most, and only in rare cases.

**Open decisions.**
- **Currency symbol.** The error shows plain amounts like "7.50" because the cart code has no currency anywhere. If customers should see "$7.50", checkout has to add the symbol, or the cart needs to know the currency.
- **Structured error.** The amount to add is only in the message text. If checkout wants to show it in its own wording, the error could also carry the amount as a number.
- **Carried over from the last change.** Removing `discountPct` and throwing on an empty coupon string are still waiting on your call.

--- delegate d2 (poteto-agent, spawned at e88) ---
e114 [d2] BRIEF RECEIVED: Repo: <repo>, branch coupon-codes (Node ESM, `npm test` runs `node --test`). Own this diff directly; do not spawn agents. Do not commit. Read src/cart.js and test/cart.test.js first.

Requirement: FLAT5 is only accepted when the subtotal is at least 20. Below that, reject it with an error telling the customer how much more they need to add. SAVE10 has no minimum.

Data shape (implement exactly this). Each COUPONS entry becomes an object with a minimum and a discount function, so eligibility is data, not a branch on the code name:
  const COUPONS = {
    SAVE10: { minSubtotal: 0, discount: (subtotal) => roundCents(subtotal * 0.1) },
    FLAT5: { minSubtotal: 20, discount: () => 5 },
  };
FLAT5's `Math.min(5, subtotal)` clamp goes away because it can no longer apply once the subtotal is at l [...1067 more chars]
e115 [d2] read <repo>/src/cart.js (full)
e116 [d2] read <repo>/test/cart.test.js (full)
e117 [d2] edit <repo>/src/cart.js
e118 [d2] says (interim): Now the tests.
e119 [d2] edit <repo>/test/cart.test.js
e120 [d2] edit <repo>/test/cart.test.js
e121 [d2] run: npm test 2>&1
e122 [d2] says (interim): All 11 tests pass.
e123 [d2] run: git diff
e124 [d2] says (interim): Applied principle prove-it-works (`~/.claude/skills/poteto-mode/principles/prove-it-works.md`): ran the actual test suite after the change rather than reasoning about it, and captured both the command and its full output below as evidence.

npm test output (verbatim):

```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (1.9944ms)
✔ rounds each line to cents (0.1747ms)
✔ SAVE10 takes 10% off the subtotal before shipping (0.159ms)
✔ FLAT5 takes 5 off the subtotal before shipping (0.1625ms)
✔ FLAT5 is accepted at exactly the minimum subtotal (0.1217ms)
✔ FLAT5 below the minimum subtotal is rejected (0.8623ms)
✔ FLAT5 rejected by a one cent shortfall (0.1984ms)
✔ SAVE10 rounds the discount to cents (0.1213ms)
✔ coupon codes are case and whitespace insensitive (0.2879ms)
✔ rejects an unknown coupon code (0.3463ms)
✔ an empty cart costs nothing (0.1545ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 113.1716
```

git diff (verbatim, shown above in the tool call) covers:
- `<repo>/src/cart.js`: `COUPONS` entries now hold `{ minSubtotal, discount }`; `computeTotal` checks `subtotal < minSubtotal` after the unknown-code check and throws the required message, with no branching on coupon name.
- `<repo>/test/cart.test.js`: removed the obsolete "never takes below zero" test, added the exactly-20, below-minimum, and one-cent-shortfall tests with the literal messages.

No changes were committed, per instructions.
e125 [d2] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e126 [d2] read <pstack>/poteto-mode/SKILL.md (full)
e127 [d2] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e128 [d2] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e129 [d2] other tool call
e130 [d2] run: find / -iname "SKILL.md" -path "*unslop*" 2>/dev/null
e131 [d2] run: find <pstack> -maxdepth 2 -iname "*unslop*"
e132 [d2] other tool call
e133 [d2] run: find <home>/.claude -iname "*unslop*" 2>/dev/null; find /c/Users -maxdepth 4 -iname "*unslop*" 2>/dev/null
e134 [d2] read <real-home>/.claude/skills/unslop/SKILL.md (full)
e135 [d2] FINAL MESSAGE TO PARENT:
Now the fixed final report, rewritten per unslop and citing only principles read in full this session.

**Shape.** `COUPONS[code]` is now `{ minSubtotal: number, discount: (subtotal) => number }`, a lookup table instead of a bare function map, per **principle-model-the-domain** (`<real-home>\.claude\skills\poteto-mode\principles\model-the-domain.md`, read this session): eligibility and payout both live as data on the same record, so `computeTotal` never branches on a coupon's name.

`src/cart.js`: `COUPONS.SAVE10` keeps `minSubtotal: 0`. `COUPONS.FLAT5` gets `minSubtotal: 20` and its `discount` drops the old `Math.min(5, subtotal)` clamp since a subtotal below 20 can no longer reach it. `computeTotal` reads `entry.minSubtotal` after the unknown-code check and throws `${code} needs a subtotal of at least ${minSubtotal.toFixed(2)}. Add ${roundCents(minSubtotal - subtotal).toFixed(2)} more to use it.` when the subtotal falls short.

`test/cart.test.js`: deleted "FLAT5 never takes the subtotal below zero" (the behavior it checked no longer exists). Added three tests, each calling `computeTotal` and asserting a literal value or message per **principle-test-behavior-not-implementation** (`<real-home>\.claude\skills\poteto-mode\principles\test-behavior-not-implementation.md`, read this session): subtotal exactly 20 returns 20, subtotal 12.50 throws the full "Add 7.50 more" message, and subtotal 19.99 throws the full "Add 0.01 more" message (the one-cent case that would fail on float noise without `roundCents`).

Ran `npm test` and read the full output rather than trusting a proxy, per **principle-prove-it-works** (`<real-home>\.claude\skills\poteto-mode\principles\prove-it-works.md`, read this session):

```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (1.9944ms)
✔ rounds each line to cents (0.1747ms)
✔ SAVE10 takes 10% off the subtotal before shipping (0.159ms)
✔ FLAT5 takes 5 off the subtotal before shipping (0.1625ms)
✔ FLAT5 is accepted at exactly the minimum subtotal (0.1217ms)
✔ FLAT5 below the minimum subtotal is rejected (0.8623ms)
✔ FLAT5 rejected by a one cent shortfall (0.1984ms)
✔ SAVE10 rounds the discount to cents (0.1213ms)
✔ coupon codes are case and whitespace insensitive (0.2879ms)
✔ rejects an unknown coupon code (0.3463ms)
✔ an empty cart costs nothing (0.1545ms)
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

`git diff` (verbatim, both files):

```diff
diff --git a/src/cart.js b/src/cart.js
index b1658a5..949ffda 100644
--- a/src/cart.js
+++ b/src/cart.js
@@ -6,8 +6,8 @@ export function lineTotal(item) {
 }
 
 const COUPONS = {
-  SAVE10: (subtotal) => roundCents(subtotal * 0.1),
-  FLAT5: (subtotal) => Math.min(5, subtotal),
+  SAVE10: { minSubtotal: 0, discount: (subtotal) => roundCents(subtotal * 0.1) },
+  FLAT5: { minSubtotal: 20, discount: () => 5 },
 };
 
 export function computeTotal(items, { coupon } = {}) {
@@ -15,11 +15,17 @@ export function computeTotal(items, { coupon } = {}) {
   let discount = 0;
   if (coupon !== undefined) {
     const code = coupon.trim().toUpperCase();
-    const discountFor = COUPONS[code];
-    if (!discountFor) {
+    const entry = COUPONS[code];
+    if (!entry) {
       throw new Error(`Unknown coupon code "${coupon}"`);
     }
-    discount = discountFor(subtotal);
+    const { minSubtotal } = entry;
+    if (subtotal < minSubtotal) {
+      throw new Error(
+        `${code} needs a subtotal of at least ${minSubtotal.toFixed(2)}. Add ${roundCents(minSubtotal - subtotal).toFixed(2)} more to use it.`,
+      );
+    }
+    discount = entry.discount(subtotal);
   }
   return roundCents(subtotal - discount + shippingFor(items));
 }
diff --git a/test/cart.test.js b/test/cart.test.js
index 8352557..421da12 100644
--- a/test/cart.test.js
+++ b/test/cart.test.js
@@ -18,15 +18,29 @@ test("FLAT5 takes 5 off the subtotal before shipping", () => {
   assert.equal(computeTotal([{ price: 20, qty: 2 }], { coupon: "FLAT5" }), 40);
 });
 
+test("FLAT5 is accepted at exactly the minimum subtotal", () => {
+  assert.equal(computeTotal([{ price: 20, qty: 1 }], { coupon: "FLAT5" }), 20);
+});
+
+test("FLAT5 below the minimum subtotal is rejected", () => {
+  assert.throws(
+    () => computeTotal([{ price: 12.5, qty: 1 }], { coupon: "FLAT5" }),
+    { message: "FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it." },
+  );
+});
+
+test("FLAT5 rejected by a one cent shortfall", () => {
+  assert.throws(
+    () => computeTotal([{ price: 19.99, qty: 1 }], { coupon: "FLAT5" }),
+    { message: "FLAT5 needs a subtotal of at least 20.00. Add 0.01 more to use it." },
+  );
+});
+
 test("SAVE10 rounds the discount to cents", () => {
   // subtotal 7.77 * 10% = 0.777, which rounds up to 0.78
   assert.equal(computeTotal([{ price: 7.77, qty: 1 }], { coupon: "SAVE10" }), 11.99);
 });
 
-test("FLAT5 never takes the subtotal below zero", () => {
-  assert.equal(computeTotal([{ price: 3, qty: 1 }], { coupon: "FLAT5" }), 5);
-});
-
 test("coupon codes are case and whitespace insensitive", () => {
   assert.equal(computeTotal([{ price: 20, qty: 2 }], { coupon: " save10 " }), 41);
 });
```

Files touched: `<repo>/src/cart.js`, `<repo>/test/cart.test.js`. Nothing was committed.
--- end of delegate d2 ---

--- delegate d3 (poteto-agent, spawned at e98) ---
e136 [d3] BRIEF RECEIVED: Repo: <repo>, branch coupon-codes, uncommitted changes present (keep them). Own this diff directly; do not spawn agents; do not commit.

Bug: test "FLAT5 is accepted when lines add up to exactly the minimum" in test/cart.test.js fails with "FLAT5 needs a subtotal of at least 20.00. Add 0.00 more to use it." Lines 0.02 + 16.08 + 3.90 sum in floating point to just under 20, so `subtotal < minSubtotal` is true.

Root-cause fix, exactly one change in src/cart.js computeTotal: round the subtotal once where it is computed:
  const subtotal = roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0));
Do not add epsilon comparisons or any other guard. Do not touch the tests. Change nothing else.

Success: `npm test` all 12 pass. Report `npm test` output and `git diff src/cart.js` verbatim.
e137 [d3] read <repo>/src/cart.js (full)
e138 [d3] edit <repo>/src/cart.js
e139 [d3] run: cd "<repo>" && npm test
e140 [d3] says (interim): All 12 tests pass, including the previously failing one.

Principle applied: prove-it-works (read in full from `<pstack>/poteto-mode/principles/prove-it-works.md`) — required pasting failing-then-passing output verbatim, but since the fix landed before I ran tests, I only have the passing run plus the documented failure message from the task description. No other principles changed a decision here; this was a single prescribed one-line fix.

Failing behavior (as given in the task, reproducing the float sum 0.02 + 16.08 + 3.90 < 20):
```
FLAT5 needs a subtotal of at least 20.00. Add 0.00 more to use it.
```

Passing output (measured, `npm test`):
```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (2.163ms)
✔ rounds each line to cents (0.1748ms)
✔ SAVE10 takes 10% off the subtotal before shipping (0.1769ms)
✔ FLAT5 takes 5 off the subtotal before shipping (0.1292ms)
✔ FLAT5 is accepted at exactly the minimum subtotal (0.1232ms)
✔ FLAT5 is accepted when lines add up to exactly the minimum (0.1491ms)
✔ FLAT5 below the minimum subtotal is rejected (0.7764ms)
✔ FLAT5 rejected by a one cent shortfall (0.1779ms)
✔ SAVE10 rounds the discount to cents (0.2034ms)
✔ coupon codes are case and whitespace insensitive (0.2257ms)
✔ rejects an unknown coupon code (0.1595ms)
✔ an empty cart costs nothing (0.1324ms)
ℹ tests 12
ℹ pass 12
ℹ fail 0
```

`git diff src/cart.js`:
```diff
diff --git a/src/cart.js b/src/cart.js
index 30fa8ac..a3c4c07 100644
--- a/src/cart.js
 [...460 more chars]
e141 [d3] run: find ~/.claude/skills -iname "*unslop*" 2>/dev/null; echo ---; cat "<pstack>/poteto-mode/principles/prove-it-works.md" 2>/dev/null
e142 [d3] read <pstack>/poteto-mode/principles/prove-it-works.md (full)
e143 [d3] run: find / -iname "SKILL.md" -path "*unslop*" 2>/dev/null
e144 [d3] other tool call
e145 [d3] run: ls "<pstack>/" 2>/dev/null; echo ---; ls ~/.claude/skills/ 2>/dev/null
e146 [d3] read <pstack>/unslop/SKILL.md (full)
e147 [d3] FINAL MESSAGE TO PARENT:
Fix task: src/cart.js in the shop-cart repo.

Principle read in full: prove-it-works (`<pstack>/poteto-mode/principles/prove-it-works.md`). It requires checking the real thing directly rather than trusting proxies, so I ran `npm test` myself and read the actual output rather than assuming the fix worked because the diff looked right.

Applied edit, exactly one line changed:

```diff
diff --git a/src/cart.js b/src/cart.js
index 30fa8ac..a3c4c07 100644
--- a/src/cart.js
+++ b/src/cart.js
@@ -11,7 +11,7 @@ const COUPONS = {
 };
 
 export function computeTotal(items, { coupon } = {}) {
-  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
+  const subtotal = roundCents(items.reduce((sum, item) => sum + lineTotal(item), 0));
   let discount = 0;
   if (coupon !== undefined) {
     const code = coupon.trim().toUpperCase();
```

Failing behavior, as given in the task (floating point sum of 0.02 + 16.08 + 3.90 lands just under 20):
```
FLAT5 needs a subtotal of at least 20.00. Add 0.00 more to use it.
```

Passing output, from running `npm test` after the fix:
```
> shop-cart@0.3.0 test
> node --test

✔ sums line items plus flat shipping (2.163ms)
✔ rounds each line to cents (0.1748ms)
✔ SAVE10 takes 10% off the subtotal before shipping (0.1769ms)
✔ FLAT5 takes 5 off the subtotal before shipping (0.1292ms)
✔ FLAT5 is accepted at exactly the minimum subtotal (0.1232ms)
✔ FLAT5 is accepted when lines add up to exactly the minimum (0.1491ms)
✔ FLAT5 below the minimum subtotal is rejected (0.7764ms)
✔ FLAT5 rejected by a one cent shortfall (0.1779ms)
✔ SAVE10 rounds the discount to cents (0.2034ms)
✔ coupon codes are case and whitespace insensitive (0.2257ms)
✔ rejects an unknown coupon code (0.1595ms)
✔ an empty cart costs nothing (0.1324ms)
ℹ tests 12
ℹ pass 12
ℹ fail 0
```

All 12 tests pass. File changed: `<repo>/src/cart.js`. No other files touched, nothing committed.
--- end of delegate d3 ---

=== turn t2 ===
e148 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e149 [main] run: cd <pstack> && cat poteto-mode/playbooks/investigation.md; echo ====; cat interrogate/SKILL.md | head -80
e150 [main] read <pstack>/poteto-mode/playbooks/investigation.md (full)
e151 [main] read <pstack>/interrogate/SKILL.md (partial)
e152 [main] task list create: [todo] 1. Route through the **how** skill. For motivation questions, also route through the **why** skill.
e153 [main] task list create: [todo] 2. Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only investigation`.
e154 [main] task list create: [todo] 3. Produce the `how`-shaped output, or a recommendation with a tradeoffs table if the request is a decision between alternatives.
e155 [main] task list create: [todo] 4. Apply the **unslop** skill to the reply.
e156 [main] task list create: [todo] Run interrogate on main...coupon-codes with independent reviewers
e157 [main] run: cd <pstack>/interrogate && sed -n 80,200p SKILL.md; echo ====; cat references/reviewer-prompt.md; echo ====; cat references/rubric.md; echo ====; cat references/code-quality-review.md; echo ====; cat references/lead-judgment.md
e158 [main] read <pstack>/interrogate/SKILL.md (partial)
e159 [main] task list update: [done] 1. Route through the **how** skill. skip: I built this branch this session and the whole module is under 40 lines; interrogate supplies the fresh eyes instead
e160 [main] task list update: [done] 2. throughput checkpoint: n/a, read-only investigation
e161 [main] task list update: [doing] 21
e162 [main] run: git diff main...coupon-codes > /tmp/coupon.diff; wc -l /tmp/coupon.diff; cat src/cart.js
e163 [main] run: git diff main...coupon-codes
e164 [main] says (interim): I'm sending this to two independent reviewers who start fresh. I directed this code myself, so my own read is likely to go easy on it.
e165 [main] spawn explorer delegate, model tier inherit, foreground. Brief: You are an adversarial code reviewer. Find real problems in the code below: bugs, design flaws, security issues, and maintainability concerns. You are not here to be helpful or encouraging. You are here to stress-test.

## Intent

> Add coupon codes to the shop cart's pricing function. `computeTotal(items, { coupon })` accepts one optional code per order. SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal but is only accepted when the subtotal is at least 20; below that it is rejected with an error telling the customer how much more they need to add. An unknown code is rejected with a clear error. Shipping is never discounted. The previous `discountPct` option (whose only in-repo caller was a test that failed because it passed 10 meaning 10%) is removed so coupons are the si [...1318 more chars]
e166 [main] spawn explorer delegate, model tier inherit, foreground. Brief: You are an adversarial code reviewer. Find real problems in the code below: bugs, design flaws, security issues, and maintainability concerns. You are not here to be helpful or encouraging. You are here to stress-test.

## Intent

> Add coupon codes to the shop cart's pricing function. `computeTotal(items, { coupon })` accepts one optional code per order. SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal but is only accepted when the subtotal is at least 20; below that it is rejected with an error telling the customer how much more they need to add. An unknown code is rejected with a clear error. Shipping is never discounted. The previous `discountPct` option (whose only in-repo caller was a test that failed because it passed 10 meaning 10%) is removed so coupons are the si [...1318 more chars]
e167 [main] says (interim): While they work, I'm checking the suspects from my own read by running them. None of these runs changes any files.
e168 [main] run: node -e '
import("./src/cart.js").then(m=>{
  const cart=[{price:20,qty:2}];
  const run=(label,f)=>{ try { console.log(label,"->",f()) } catch(e){ console.log(label,"-> throws",e.constructor.name+":",e.message) } };
  run("coupon null", ()=>m.computeTotal(cart,{coupon:null}));
  run("coupon empty string", ()=>m.computeTotal(cart,{coupon:""}));
  run("coupon 10 (number)", ()=>m.computeTotal(cart,{ [...987 more chars]
e169 [main] run: node -e '
import("./src/cart.js").then(m=>{
  let wrong=0, ex=[];
  for (let c=1;c<=100000;c++){ const want=(c - Math.floor((c+5)/10) + 500)/100;
    const got=m.computeTotal([{price:c/100,qty:1}],{coupon:"SAVE10"}); if(got!==want){wrong++; if(ex.length<4) ex.push([c/100,want,got])} }
  let halfCents=0; for (let c=1;c<=100000;c++) if(c%10===5) halfCents++;
  console.log({subtotalsChecked:100000, w [...141 more chars]
e170 [main] task list update: [doing] 19
e171 [main] says (interim): Both reviewers are still running. The verdict will come once they report back and I've checked their findings.
e172 [main] says (interim): Reviewer A is done, with seven findings. They include both issues I found myself, reached on its own. I'm waiting on reviewer B.
e173 [main] run: node -e 'import("./src/cart.js").then(m=>{ try{m.computeTotal([{price:-5,qty:1}],{coupon:"SAVE10"})}catch(e){console.log(e.message)}; console.log(m.lineTotal({price:1.005,qty:1}), m.computeTotal([{price:10.35,qty:1}],{coupon:"SAVE10"}), m.computeTotal([{price:10.25,qty:1}],{coupon:"SAVE10"})) })'; git show main:src/money.js
e174 [main] task list update: [done] 21
e175 [main] task list update: [done] 19
e176 [main] task list update: [done] 20
e177 [main] REPLY TO USER:
If a teammate sent me `coupon-codes`, I'd block it on three things. The math the tests cover is right, and all 12 tests pass. What's wrong is how the function behaves when real checkout input reaches it. I missed all three when I called the work verified. My brute-force checks only covered FLAT5 at the 20 threshold.

To get a second read, I had two reviewers go through the branch from scratch. Neither had seen our conversation. Each of them found all three blockers without seeing the other's work. I also reran every piece of evidence below myself.

## What I'd block on

**1. A blank coupon field breaks checkout.** The code only treats `undefined` as "no coupon". A form usually sends `""` or `null` when the box is left empty. On a 40.00 cart, these are the results I measured:
- `""` throws `Unknown coupon code ""`. A customer who typed nothing is told their code is wrong.
- `null` throws `TypeError: Cannot read properties of null (reading 'trim')`.
- `10` throws `TypeError: coupon.trim is not a function`.

The fix is to treat `null` and blank text as no coupon, reject anything that isn't text, and add tests for `""`, `"  "` and `null`. This belongs at the entry point, per principle-boundary-discipline.

**2. Checkout can't tell a customer error from a bug.** The coupon errors are meant to be shown to customers, but they're plain `Error`s, the same type as a crash. Checkout has two bad options. It can show every error message, including the `TypeError` above. Or it can match on message text, which breaks the first time someone rewords a message. The fix is a `CouponError` with a `code` (unknown or below minimum) and the amount still needed as a number. It also fixes a smaller problem. The unknown-code message repeats the customer's raw text back, so `"<img src=x onerror=alert(1)>"` ends up in a string meant for the page. Whether that's exploitable depends on how checkout renders it, and that code isn't in this repo.

**3. SAVE10 rounds half-cent discounts inconsistently.** When 10% of the subtotal lands exactly on half a cent, the rounding should always go the same way. I checked every subtotal from 0.01 to 1000.00. 204 of them get a discount one cent lower than consistent round-half-up would give. On the other ties it rounds up. For example, 10.35 comes to 14.32 (discount 1.03) while 10.25 comes to 14.22 (discount 1.03). This repo already had a one-cent reconciliation incident with finance (FIN-212), so I wouldn't ship a discount finance can't reproduce.

The root cause is `roundCents` in `src/money.js`, which does `Math.round(amount * 100) / 100` on floating-point numbers. It predates this branch and hits line totals too. `lineTotal({ price: 1.005, qty: 1 })` returns 1. Per principle-fix-root-causes, the fix goes in `money.js`, working in whole cents, as its own commit before the coupon change. Then add tie tests at 10.35 and 10.25. SAVE10's discount formula doesn't need a special-case patch.

## Worth fixing before merge, not blocking

**Leftover `discountPct` calls fail silently.** Unknown option keys are dropped, so `computeTotal(cart, { discountPct: 0.1 })` returns 45, full price, with no error. Both reviewers found no caller in the repo, and I found none earlier. Still, it's a breaking change to an exported function, and `package.json` stays at 0.3.0. I'd bump to 0.4.0 and throw if `discountPct` is passed, so an old caller fails loudly instead of overcharging.

**The README doesn't document the errors.** Checkout's integration depends on those errors, so the README should say what `computeTotal` throws and that `discountPct` is gone. This is quick once blocker 2 has decided the error shape.

## Noted, not actionable

- **Unvalidated negative prices.** The cart never checks prices, so a negative one reaches the minimum check. A -5.00 cart with SAVE10 says "needs a subtotal of at least 0.00". That's input validation the module never had, and it belongs with whatever validates checkout's items.
- **Prototype keys.** `COUPONS[code]` can't match `constructor` or `__proto__`, but only because the code is uppercased first. Switching to `Object.hasOwn` would make that safety explicit. It's cheap, but nothing is broken today.

## Dismissed

- Reviewer A suggested making the table plain data, like `{ kind: "percent", value: 10 }`. That's a preference with no defect behind it. Once blocker 3 fixes `roundCents`, the table as it stands already gives one place to compute discounts in whole cents.

## How the reviewers compared

Every blocker was found by both reviewers on their own, and by my own probing before either reported back. All three reviews ran on the same underlying model, though, so that agreement is weaker evidence than it looks. The weight comes from the evidence, which I reproduced by running each input. Reviewer B also noted one thing that is not a problem. The subtotal rounding I added last turn is needed, because without it 0.02 + 16.08 + 3.90 sums to `19.999999999999996`.

Nothing was changed during this review. The branch is still at `88927fe`. I can fix all three blockers as a follow-up. The order would be `money.js` rounding first, then blank-coupon handling and `CouponError` together, then the version bump. Which reading of a blank field did you mean, no coupon or an error? My recommendation is to treat it as no coupon.

--- delegate d4 (explorer, spawned at e165) ---
e178 [d4] BRIEF RECEIVED: You are an adversarial code reviewer. Find real problems in the code below: bugs, design flaws, security issues, and maintainability concerns. You are not here to be helpful or encouraging. You are here to stress-test.

## Intent

> Add coupon codes to the shop cart's pricing function. `computeTotal(items, { coupon })` accepts one optional code per order. SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal but is only accepted when the subtotal is at least 20; below that it is rejected with an error telling the customer how much more they need to add. An unknown code is rejected with a clear error. Shipping is never discounted. The previous `discountPct` option (whose only in-repo caller was a test that failed because it passed 10 meaning 10%) is removed so coupons are the si [...1318 more chars]
e179 [d4] run: git diff main...coupon-codes && echo ===== && cat -n src/cart.js src/money.js src/shipping.js && echo ==== && cat -n test/cart.test.js && cat README.md package.json
e180 [d4] read <pstack>/interrogate/references/rubric.md (full)
e181 [d4] read <pstack>/interrogate/references/code-quality-review.md (full)
e182 [d4] run: npm test 2>&1 | tail -12; node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
const t=(l,f)=>{try{console.log(l, JSON.stringify(f()))}catch(e){console.log(l, e.constructor.name+": "+e.message)}};
const it=[{price:20,qty:2}];
t("null", ()=>computeTotal(it,{coupon:null}));
t("empty", ()=>computeTotal(it,{coupon:""}));
t("spaces", ()=>computeTotal(it,{coupon:"   "}));
t("numbe [...760 more chars]
e183 [d4] run: node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
for (const p of [10.35, 10.25, 10.45, 21.15, 0.35]) console.log(p, "->", computeTotal([{price:p,qty:1}],{coupon:"SAVE10"}), " raw discount", p*0.1);
'; git log --oneline main..coupon-codes; grep -rn "discountPct\|computeTotal" --include=*.js --include=*.md . | grep -v node_modules
e184 [d4] FINAL MESSAGE TO PARENT:
## Findings

### 1. [warning] SAVE10 rounds half-cent discounts either way, depending on float noise
**Location**: <repo>/src/cart.js:9 (`roundCents(subtotal * 0.1)`), plus `roundCents` in <repo>/src/money.js:1
**Finding**: When 10% of the subtotal lands exactly on half a cent, the discount should round the same way every time. It doesn't. `subtotal * 0.1` is computed in binary floating point, so an exact 1.035 can come out as 1.03499999… and round down, while 1.025 comes out as 1.02500000…1 and rounds up. The test at test/cart.test.js:44 only covers 0.777, which isn't a half-cent case, so it misses this.
**Evidence** (run):
```
10.35 -> 14.32  raw discount 1.035                 (discount 1.03, rounded DOWN)
10.25 -> 14.22  raw discount 1.0250000000000001    (discount 1.03, rounded UP)
10.45 -> 14.4   raw discount 1.045                 (discount 1.05, rounded UP)
21.15 -> 24.04  raw discount 2.1149999999999998    (discount 2.11, rounded DOWN)
0.35  -> 5.32   raw discount 0.034999999999999996  (discount 0.03, rounded DOWN)
```
I swept every subtotal from 0.01 to 1000.00. 204 of them give a different discount than half-up rounding on integer cents. This is a pricing module that exists partly for finance reconciliation (FIN-212), so the discount should follow one rule that finance can reproduce.
**Suggestion**: Compute the discount in integer cents, e.g. `discount: (subtotal) => Math.round(Math.round(subtotal * 100) / 10) / 100`. Or better, have `roundCents`/`money.js` work in integer cents throughout. Add tests at 10.35 and 10.25 that pin the chosen rule.

### 2. [warning] An empty or null coupon breaks checkout instead of meaning "no coupon"
**Location**: <repo>/src/cart.js:16-17
**Finding**: The only check is `coupon !== undefined`. A checkout form with a blank coupon field usually sends `""` or `null`, not `undefined`. A blank field should price the order with no coupon. Instead, `""` is rejected with a confusing customer-facing error, and `null` or a number crashes with a TypeError that doesn't come from the coupon logic at all.
**Evidence** (run):
```
coupon: null   -> TypeError: Cannot read properties of null (reading 'trim')
coupon: ""     -> Error: Unknown coupon code ""
coupon: "   "  -> Error: Unknown coupon code "   "
coupon: 10     -> TypeError: coupon.trim is not a function
```
**Suggestion**: Normalise once at the entry point, e.g. `const code = (coupon ?? "").trim().toUpperCase(); if (code !== "") { ... }`. Reject non-string input explicitly. Add tests for `""` and `null`.

### 3. [warning] Customer-facing errors can't be told apart from programming errors
**Location**: <repo>/src/cart.js:20, 24-26
**Finding**: The intent says these errors are shown to the customer at checkout. They are plain `Error`s, the same type every other failure throws. The caller has no structural way to tell "show this message to the customer" apart from "internal bug, don't leak it". Finding 2 shows that a bad input produces a `TypeError` whose message ("Cannot read properties of null…") would reach the customer if the caller displays `err.message` for every error. The only way to tell them apart is to match on message text, which is fragile.
**Evidence**: Finding 2's output. Both paths throw an `Error` subclass with no code or other field to distinguish them.
**Suggestion**: Add `class CouponError extends Error` with a `code` field (`"unknown"` or `"below_minimum"`), plus the amount still needed for `below_minimum`. Throw it from both branches, and have tests assert the class, not only the message.

### 4. [warning] The customer's raw input is echoed into the error message
**Location**: <repo>/src/cart.js:20
**Finding**: The unknown-code error puts the raw, untrimmed `coupon` string into a message meant for display. Nothing limits its length or characters, and the text is attacker-controlled. Whether this becomes an XSS hole depends on how checkout renders the message, and that code isn't in this repo, so this is a hazard, not a proven exploit. The echo also contradicts the rest of the function: the below-minimum error uses the normalised `code`, but this one uses the raw input.
**Evidence** (run): `coupon: "<img src=x onerror=alert(1)>"` produces `Unknown coupon code "<img src=x onerror=alert(1)>"`, and `" bogus "` produces `Unknown coupon code " bogus "` with the whitespace kept.
**Suggestion**: Don't echo the input. `"That coupon code isn't valid."` is enough for a customer. If echoing is kept, use the trimmed, normalised `code` and cap its length.

### 5. [warning] Callers still passing the removed `discountPct` get full price with no error
**Location**: <repo>/src/cart.js:13; <repo>/package.json (`"version": "0.3.0"`)
**Finding**: `discountPct` was removed from the options, but destructuring silently ignores unknown keys. Any caller still passing it gets an undiscounted total and no failure. The public signature changed but the package version wasn't bumped, so nothing tells a consumer about it. There are no other callers in the repo (I grepped). The concern is out-of-repo callers and version hygiene.
**Evidence** (run): `computeTotal([{price:20,qty:2}], {discountPct:0.1})` returns `45`, which is full price plus shipping.
**Suggestion**: Bump the version for the breaking API change. Optionally throw if `"discountPct" in options`, so a stale caller fails loudly instead of overcharging.

### 6. [nit] The minimum-subtotal check is generic but only FLAT5 uses it
**Location**: <repo>/src/cart.js:8-11, 22-27
**Finding**: SAVE10 carries `minSubtotal: 0` only to satisfy the shared check, and the error message is built from `minSubtotal` although only FLAT5 can ever trigger it. With two codes this is acceptable. But the table mixes data (`minSubtotal`) with behaviour (a `discount` closure) when a plain shape like `{ kind: "percent", value: 10 }` / `{ kind: "flat", value: 5, min: 20 }` would be simpler to read. That shape would also let the discount be computed in cents in one place (Finding 1). A lookup on a plain object literal is also only safe from `Object.prototype` keys by accident, because the code is uppercased first. A `Map` or `Object.hasOwn` makes that safety explicit.
**Suggestion**: Make the table plain data, apply it through one cents-based helper, and look codes up with `Object.hasOwn(COUPONS, code)`.

### 7. [nit] README doesn't document the error contract
**Location**: <repo>/README.md:5
**Finding**: The README names the two codes but not that `computeTotal` throws, which errors checkout should expect to show, or that `discountPct` is gone. The error contract is the main integration surface of this change.
**Suggestion**: Add one line saying the function throws a customer-displayable coupon error for an unknown code or a subtotal below the minimum, and that `discountPct` was removed.

The existing suite passes (12/12). All the behaviour above is on paths the suite doesn't cover. I changed no files; the evidence came from read-only `node -e` runs against `src/cart.js`.
--- end of delegate d4 ---

--- delegate d5 (explorer, spawned at e166) ---
e185 [d5] BRIEF RECEIVED: You are an adversarial code reviewer. Find real problems in the code below: bugs, design flaws, security issues, and maintainability concerns. You are not here to be helpful or encouraging. You are here to stress-test.

## Intent

> Add coupon codes to the shop cart's pricing function. `computeTotal(items, { coupon })` accepts one optional code per order. SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal but is only accepted when the subtotal is at least 20; below that it is rejected with an error telling the customer how much more they need to add. An unknown code is rejected with a clear error. Shipping is never discounted. The previous `discountPct` option (whose only in-repo caller was a test that failed because it passed 10 meaning 10%) is removed so coupons are the si [...1318 more chars]
e186 [d5] run: git diff main...coupon-codes && cat src/cart.js src/money.js src/shipping.js test/cart.test.js README.md package.json
e187 [d5] read <pstack>/interrogate/references/rubric.md (full)
e188 [d5] read <pstack>/interrogate/references/code-quality-review.md (full)
e189 [d5] run: npm test 2>&1 | tail -12; grep -rn "discountPct\|computeTotal" --include=*.js --include=*.md . | grep -v node_modules; git log --oneline main..coupon-codes; cat > /dev/null; node --input-type=module -e '
import { computeTotal, lineTotal } from "./src/cart.js";
import { roundCents } from "./src/money.js";
const t=(l,f)=>{try{console.log(l,"=>",JSON.stringify(f()))}catch(e){console.log(l,"THROWS",e. [...1007 more chars]
e190 [d5] other tool call
e191 [d5] other tool call
e192 [d5] run: npm test 2>&1 | tail -10; grep -rn "discountPct\|computeTotal" --include=*.js --include=*.md . | grep -v node_modules; node --input-type=module -e '
import { computeTotal, lineTotal } from "./src/cart.js";
import { roundCents } from "./src/money.js";
const t=(l,f)=>{try{console.log(l,"=>",JSON.stringify(f()))}catch(e){console.log(l,"THROWS",e.constructor.name+":",e.message)}};
const it=[{price:20, [...904 more chars]
e193 [d5] FINAL MESSAGE TO PARENT:
## Findings

### 1. [warning] A blank coupon field is rejected as an unknown code, and `null` or a non-string crashes with a TypeError
**Location**: src/cart.js:16-21
**Finding**: The code only checks `coupon !== undefined`. Checkout forms usually send `""` or `null` when the coupon box is left empty. Neither of those means "no coupon" here.
**Evidence** (run with `node -e` on `[{price:20,qty:2}]`):
- `{coupon:""}` threw `Error: Unknown coupon code ""`
- `{coupon:"  "}` threw `Error: Unknown coupon code "  "`
- `{coupon:null}` threw `TypeError: Cannot read properties of null (reading 'trim')`
- `{coupon:10}` threw `TypeError: coupon.trim is not a function`

So a customer who types nothing gets told their code is unknown. A caller that passes `null` gets an internal TypeError, and because these errors are meant to be shown at checkout, that text may reach the customer. No test covers these inputs.
**Suggestion**: Normalize first, e.g. `const code = (coupon ?? "").trim().toUpperCase(); if (code) { ... }`. Reject non-string values explicitly, and add tests for `""`, `"  "` and `null`.

### 2. [warning] Customer-facing errors are plain `Error`, so checkout can't tell them apart from bugs
**Location**: src/cart.js:20, src/cart.js:24-26
**Finding**: The coupon rejections are meant to be shown to the customer. They are thrown as bare `Error`, the same type as any programming fault. To show "Add 7.50 more", checkout has two options. It can display every `e.message`, which leaks messages like the TypeError in finding 1. Or it can match on the message text, which is fragile.
**Evidence**: Finding 1 shows a `TypeError` and a customer rejection coming out of the same call. The only thing that separates them is the constructor name. Nothing marks a message as safe to show.
**Suggestion**: Throw a dedicated `CouponError extends Error` with a `code` field (`"UNKNOWN_COUPON"`, `"BELOW_MINIMUM"`) plus `minSubtotal` and `shortfall`. Checkout then shows only `CouponError` messages and can localize or format them.

### 3. [warning] Callers still passing the removed `discountPct` silently get no discount
**Location**: src/cart.js:13
**Finding**: The options are destructured as `{ coupon }`, so any other key is dropped without a sign. Removing `discountPct` is a breaking API change, but it doesn't fail. It quietly charges full price. The same applies to typos like `{ coupons: "SAVE10" }`. package.json stays at `0.3.0` with no changelog or README note about the removal.
**Evidence**: `computeTotal([{price:20,qty:2}], {discountPct:0.1})` returned `45`, the undiscounted total, with no error. The grep confirms no in-repo caller remains, which matches the intent. Anything outside this repo would break silently, though.
**Suggestion**: Throw on unknown option keys, or at least on `discountPct` (`if ("discountPct" in opts) throw new Error("discountPct was removed; use coupon")`). Bump the version as a breaking change.

### 4. [warning] SAVE10 rounds half-cent discounts inconsistently, and the test doesn't cover it
**Location**: src/cart.js:9 (`roundCents(subtotal * 0.1)`), src/money.js:1, test/cart.test.js:44-47
**Finding**: A SAVE10 discount on a subtotal ending in 5 cents lands exactly on a half cent. `Math.round(x*100)/100` on binary floats rounds some of these up and some down. The intent is to reconcile with finance (FIN-212), so customers with the same kind of cart get different results.
**Evidence**: I checked every such subtotal from 0.05 to 999.95 (10,000 cases). 9,796 rounded up and 204 rounded down. Examples that rounded down:
- 0.35 gives 0.03, not 0.04
- 1.45 gives 0.14
- 10.35 gives 1.03
- 21.15 gives 2.11

The same helper also gives `lineTotal({price:1.005,qty:1}) === 1`. That one predates this branch but sits on the same path. The test "SAVE10 rounds the discount to cents" uses 7.77, whose 10% is 0.777. That is not a tie, so the test can't catch this.
**Suggestion**: Work in integer cents for the discount, e.g. `Math.round(subtotalCents / 10)` with `subtotalCents = Math.round(subtotal * 100)`. Or fix `roundCents` to round ties consistently (for example `Math.round((amount + Number.EPSILON) * 100) / 100`, or integer-cent arithmetic). Add a tie test such as a 10.35 subtotal with SAVE10.

### 5. [nit] The error echoes the raw, untrimmed customer input
**Location**: src/cart.js:20
**Finding**: The unknown-code message puts `coupon` back into the text, not the normalized `code`. Stray whitespace shows up in the message. Any markup the customer typed also goes straight into a string that is meant for the checkout UI.
**Evidence**: `{coupon:" <img src=x onerror=alert(1)> "}` threw `Unknown coupon code " <img src=x onerror=alert(1)> "`. Whether that becomes XSS depends on how checkout renders the message, which isn't in this repo, so I'm flagging the risk, not a proven exploit.
**Suggestion**: Echo the trimmed `code`, or leave the input out entirely ("That coupon code isn't valid"). Moving the message into structured `CouponError` fields (finding 2) also fixes this.

### 6. [nit] `minSubtotal: 0` on SAVE10 leaves the below-minimum branch reachable with nonsense messages
**Location**: src/cart.js:9, src/cart.js:23-27
**Finding**: SAVE10 has no minimum, but the placeholder `0` means a negative subtotal triggers the minimum branch. There is no validation of `price` or `qty` anywhere, so negative input gets through.
**Evidence**: `computeTotal([{price:-5,qty:1}],{coupon:"SAVE10"})` threw `SAVE10 needs a subtotal of at least 0.00. Add 5.00 more to use it.` Separately, an empty cart with FLAT5 gives `Add 20.00 more`, which is correct.
**Suggestion**: Make `minSubtotal` optional (`if (entry.minSubtotal && subtotal < entry.minSubtotal)`). Validate item input at the boundary rather than depending on the coupon branch.

### Checked and not a problem
- The outer `roundCents` on the subtotal (cart.js:14) is needed. The unrounded sum of 0.02 + 16.08 + 3.9 is `19.999999999999996`, which would wrongly reject FLAT5, and the test on lines 24-27 guards that.
- Keys like `constructor` and `__proto__` can't match the `COUPONS` lookup, because they are uppercased before it. Luckily, not by design.
- Shipping is correctly left out of the discount.
- `npm test` passes, 12 of 12.
--- end of delegate d5 ---
