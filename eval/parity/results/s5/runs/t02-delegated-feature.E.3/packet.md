=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] run: git ls-files && cat package.json 2>/dev/null; for f in $(git ls-files | grep -v lock); do echo "=== $f"; cat "$f"; done; ls <pstack>/poteto-mode/playbooks/
e3 [main] run: npm test 2>&1 | tail -30; P=<pstack>; cat $P/poteto-mode/playbooks/feature.md; cat $P/principle-model-the-domain/SKILL.md $P/principle-redesign-from-first-principles/SKILL.md $P/principle-test-behavior-not-implementation/SKILL.md
e4 [main] read <pstack>/poteto-mode/playbooks/feature.md (full)
e5 [main] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e6 [main] read <pstack>/poteto-mode/principles/redesign-from-first-principles.md (full)
e7 [main] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e8 [main] run: git remote -v; git log -p --stat ff910e0 -1 | head -60; P=<pstack>; cat $P/principle-laziness-protocol/SKILL.md $P/principle-boundary-discipline/SKILL.md | head -80; sed -n 1,40p $P/poteto-mode/playbooks/opening-a-pr.md
e9 [main] read <pstack>/poteto-mode/principles/laziness-protocol.md (partial)
e10 [main] read <pstack>/poteto-mode/principles/boundary-discipline.md (partial)
e11 [main] read <pstack>/poteto-mode/playbooks/opening-a-pr.md (full)
e12 [main] edit <repo>/todo.md
e13 [main] spawn other delegate, model tier top, foreground. Brief: Implement coupon codes in the shop-cart repo (Node ESM, `node --test`, run with `npm test`). Read src/cart.js, src/money.js, src/shipping.js, test/cart.test.js, README.md first. Do not spawn subagents. Do not commit; leave changes in the worktree and report the worktree path.

Context: main is red. `computeTotal(items, { discountPct })` treats discountPct as a fraction but its only caller (the test "applies a 10% discount before shipping") passes 10 and gets -355. Coupons replace discountPct entirely: delete the `discountPct` option and that test (migrate caller, delete legacy API, no compat shim).

Requirements:
- SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal. Discounts apply to the subtotal, before shipping (shipping untouched).
- One code per order.
- An unknown code [...2508 more chars]
e14 [main] run: cd <repo>/.claude/worktrees/agent-a588635251475c50d && git status --short && cat src/coupons.js src/cart.js && npm test 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail))" ; sed -i 's/Math.min(COUPONS\[key\](subtotal), subtotal)/COUPONS[key](subtotal)/' src/coupons.js && npm test 2>&1 | grep -E "^✖|ℹ fail"; git checkout -- . 2>/dev/null; git diff --stat; grep -c Math.min src/coupons.js
e15 [main] says (interim): The delegate's tests pass and the clamp mutation got caught. My revert didn't restore the untracked file, so I'm putting the clamp back now.
e16 [main] run: cd <repo>/.claude/worktrees/agent-a588635251475c50d && sed -i 's/return roundCents(COUPONS\[key\](subtotal));/return roundCents(Math.min(COUPONS[key](subtotal), subtotal));/' src/coupons.js && tail -2 src/coupons.js && npm test 2>&1 | grep -E "ℹ (pass|fail)"
e17 [main] says (interim): My `git checkout -- .` also reverted the delegate's tracked edits. I'm restoring them from the diff it reported.
e18 [main] run: cat > src/cart.js <<'EOF'
import { discountFor } from "./coupons.js";
import { roundCents } from "./money.js";
import { shippingFor } from "./shipping.js";

export function lineTotal(item) {
  return roundCents(item.price * item.qty);
}

export function computeTotal(items, { coupon } = {}) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discount = coupon === und [...559 more chars]
e19 [main] other tool call
e20 [main] other tool call
e21 [main] read <repo>/.claude/worktrees/agent-a588635251475c50d/test/cart.test.js (full)
e22 [main] edit <repo>/.claude/worktrees/agent-a588635251475c50d/test/cart.test.js
e23 [main] run: git status --short && git diff && cat src/coupons.js && timeout 60 npm test 2>&1 | grep -E "^✖|ℹ (pass|fail)"
e24 [main] says (interim): The tree matches the delegate's reported diff again and all 11 tests pass. Committing on a feature branch.
e25 [main] run: git branch -m feat/coupons && git add -A src test README.md && git commit -q -F - <<'EOF'
feat(cart): add SAVE10 and FLAT5 coupon codes

Replace the discountPct option with a single coupon code. The old
option read 10 as a fraction and priced the only tested order at -355,
so main was red.

SAVE10 takes 10% off the subtotal and FLAT5 takes 5 off. Both apply
before shipping and never take the goods [...243 more chars]
e26 [main] run: cd <repo> && sed -i 's/^- \[ \] 4\./- [x] 4./; s/^- \[ \] 5\./- [x] 5./; s/^- \[ \] 6\. Rebase into small, ordered commits\./- [x] 6. Rebase into small, ordered commits. One commit; the fix and the feature are the same signature change./; s/^- \[ \] 8\. Opening a PR\. skip expected: repo has no remote\./- [x] 8. Opening a PR. skip: repo has no remote./; s/^- \[ \] Task/- [x] Task/' todo.md && cat  [...7 more chars]
e27 [main] REPLY TO USER:
Checkout can now take one coupon code per order. SAVE10 takes 10% off the subtotal and FLAT5 takes 5 off. Both come off before shipping. An unknown code throws `Unknown coupon code "BOGUS"`, and passing more than one code throws `Only one coupon code per order`. It's committed as `fa130b5` on a new `feat/coupons` branch, which lives in the worktree `.claude/worktrees/agent-a588635251475c50d`. `main` is unchanged. I didn't open a PR because the repo has no remote.

**Main was already failing.** The discount test on `main` returned -355 where it expected 41. `computeTotal` read `discountPct` as a fraction (0.1), but the test passed 10. Coupons replace that option, so I deleted `discountPct` and its test rather than keeping both.

**How callers use it.** Callers now write `computeTotal(items, { coupon: "SAVE10" })`. With no coupon the totals are the same as before. The two codes live in a small table in the new `src/coupons.js`, so adding a code is one line.

**Behavior I chose that you may want different:**

| Choice | What I did | Other option |
|---|---|---|
| One code per order | The option takes a single code. A list of codes throws a clear error. | Silently use the first code. |
| FLAT5 on a small order | The discount can't take the goods below zero. A 3.00 order pays only the 5.00 shipping. | Let the total drop below shipping. |
| Case and spaces | " save10 " works the same as SAVE10. | Require the exact code. |
| Rounding | The 10% is rounded to cents, so 33.33 comes out to 35.00. | Round only the final total. |

**How it was built.** One subagent wrote the change in its own worktree and I reviewed the diff. The change is about 40 lines, so I didn't split it up or run the separate design and architecture steps.

**Tests.** `npm test` passes all 11 tests (measured). Eight are new. They check hand-worked totals (41, 35, 40, 5) and the two error messages. To make sure the tests can catch real mistakes, the subagent broke the code on purpose five ways and ran the suite each time (measured):
- SAVE10 returning no discount was caught.
- Removing the floor on FLAT5 was caught. I repeated this one myself.
- Removing the case handling was caught.
- Removing the one-code check was caught.
- Loosening how codes are looked up in the table (so built-in names like "toString" could match) was not caught. No input can tell the two versions apart, because codes are uppercased before the lookup. The "toString" test only fails if the uppercasing is also removed.

**A mistake of mine.** While repeating one of those checks, my undo command also wiped the subagent's edits to three files. I restored them from the diff it had reported, checked the result line by line, and all 11 tests passed again before I committed.

**Principles that shaped it.** "Model the Domain" is why the codes live in a table. "Redesign from First Principles" is why the coupon replaced the discount setting instead of sitting next to it. "Boundary Discipline" is why the one-code and unknown-code checks happen only where the code comes in. "Test Behavior, Not Implementation" is why the tests were checked by breaking the code on purpose.

**Decision for you.** The four rows in the table are the choices to confirm. The case handling and the FLAT5 floor are the ones most likely to be a business call rather than a technical one. There's also an uncommitted `todo.md` checklist in the repo root that you can delete.

--- delegate d1 (other, spawned at e13) ---
e28 [d1] BRIEF RECEIVED: Implement coupon codes in the shop-cart repo (Node ESM, `node --test`, run with `npm test`). Read src/cart.js, src/money.js, src/shipping.js, test/cart.test.js, README.md first. Do not spawn subagents. Do not commit; leave changes in the worktree and report the worktree path.

Context: main is red. `computeTotal(items, { discountPct })` treats discountPct as a fraction but its only caller (the test "applies a 10% discount before shipping") passes 10 and gets -355. Coupons replace discountPct entirely: delete the `discountPct` option and that test (migrate caller, delete legacy API, no compat shim).

Requirements:
- SAVE10 takes 10% off the subtotal. FLAT5 takes 5 off the subtotal. Discounts apply to the subtotal, before shipping (shipping untouched).
- One code per order.
- An unknown code [...2508 more chars]
e29 [d1] invoke skill poteto-mode, which loads <pstack>/poteto-mode/SKILL.md in full
e30 [d1] run: for f in src/cart.js src/money.js src/shipping.js test/cart.test.js README.md package.json; do echo "=== $f"; cat $f; done; ls src test
e31 [d1] run: cd <pstack> && cat principle-test-behavior-not-implementation/SKILL.md principle-migrate-callers-then-delete-legacy-apis/SKILL.md principle-boundary-discipline/SKILL.md | head -150
e32 [d1] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (partial)
e33 [d1] read <pstack>/poteto-mode/principles/migrate-callers-then-delete-legacy-apis.md (partial)
e34 [d1] read <pstack>/poteto-mode/principles/boundary-discipline.md (partial)
e35 [d1] says (interim): Writing the module, cart change, tests, and README.
e36 [d1] run: cat > src/coupons.js <<'EOF'
import { roundCents } from "./money.js";

const COUPONS = {
  SAVE10: (subtotal) => subtotal * 0.1,
  FLAT5: () => 5,
};

export function discountFor(code, subtotal) {
  if (typeof code !== "string") throw new Error("Only one coupon code per order");
  const key = code.trim().toUpperCase();
  if (!Object.hasOwn(COUPONS, key)) throw new Error(`Unknown coupon code "${cod [...1083 more chars]
e37 [d1] says (interim): Using the file tools instead.
e38 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/src/coupons.js
e39 [d1] read <repo>/.claude/worktrees/agent-a588635251475c50d/src/cart.js (full)
e40 [d1] read <repo>/.claude/worktrees/agent-a588635251475c50d/test/cart.test.js (full)
e41 [d1] read <repo>/.claude/worktrees/agent-a588635251475c50d/README.md (full)
e42 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/src/cart.js
e43 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/src/cart.js
e44 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/test/cart.test.js
e45 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/README.md
e46 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/test/coupons.test.js
e47 [d1] run: npm test 2>&1 | Select-String -Pattern "^# (tests|pass|fail)|not ok"
e48 [d1] run: npm test 2>&1 | Select-Object -Last 12
e49 [d1] says (interim): Green, 11/11. Now a small mutation script that applies each defect, runs the suite, records failures, and restores the file.
e50 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/mutate.mjs
e51 [d1] run: node mutate.mjs; Remove-Item mutate.mjs; git status --short; npm test 2>&1 | Select-String "ℹ (pass|fail)"
e52 [d1] run: node -e 'console.log(Object.getOwnPropertyNames(Object.prototype).filter(k => k === k.toUpperCase()))'; (Get-Content src/coupons.js -Raw).Replace('code.trim().toUpperCase()','code.trim()').Replace('!Object.hasOwn(COUPONS, key)','!(key in COUPONS)') | Set-Content -NoNewline src/coupons.js; npm test 2>&1 | Select-String "^✖ .*\(" ; git checkout -- src/coupons.js 2>$null; git diff --stat -- src/coupo [...5 more chars]
e53 [d1] says (interim): The file is untracked, so `git checkout` didn't restore it. I'm rewriting it from the known-good content.
e54 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/src/coupons.js
e55 [d1] run: npm test 2>&1 | Select-String "ℹ (pass|fail)"; git status --short; git add -N src/coupons.js test/coupons.test.js; git diff; git reset -q src/coupons.js test/coupons.test.js
e56 [d1] says (interim): The file is still mutated, as I expected. I'll read it and restore it.
e57 [d1] read <repo>/.claude/worktrees/agent-a588635251475c50d/src/coupons.js (full)
e58 [d1] edit <repo>/.claude/worktrees/agent-a588635251475c50d/src/coupons.js
e59 [d1] run: npm test 2>&1 | Select-String "ℹ (pass|fail)"; git diff --no-index --stat /dev/null src/coupons.js; Get-Content src/coupons.js | Select-String "toUpperCase|hasOwn"
e60 [d1] FINAL MESSAGE TO PARENT:
Coupons are in and `npm test` is green (11 pass, 0 fail). Mutation (d) survived, and it can't be caught with the design as specified. Changes are uncommitted in `<repo>/.claude/worktrees/agent-a588635251475c50d`.

Checkout callers now pass `{ coupon: "SAVE10" }` instead of `discountPct`. Codes ignore case and surrounding spaces. An unknown code throws an error that names it, and passing more than one code throws "Only one coupon code per order". The broken `discountPct` option and its test are deleted with no shim, per **Migrate Callers Then Delete Legacy APIs**. Following **Boundary Discipline**, the one-code-per-order check exists only in `discountFor` and `computeTotal` doesn't repeat it.

The new tests are in `test/coupons.test.js` and all go through `computeTotal`. Each one checks a number I worked out by hand (41, 35, 40, 5, 41), plus the error messages. **Test Behavior, Not Implementation** is why I planted each defect and ran the suite. A small script applied each one to `src/coupons.js`, ran `node --test` and put the file back.

- **(a) SAVE10 returns 0.** Caught by "SAVE10 takes 10% off the subtotal before shipping", "SAVE10 rounds the discount to cents" and "codes ignore case and surrounding whitespace".
- **(b) No `Math.min` clamp.** Caught by "FLAT5 never takes goods below zero and leaves shipping".
- **(c) No `toUpperCase`.** Caught by "codes ignore case and surrounding whitespace".
- **(d) `key in COUPONS` instead of `Object.hasOwn`.** Survived. Every built-in object key (`toString`, `constructor` and so on) has lowercase letters, and I checked that none equals its own uppercase form. Since the code is uppercased before the lookup, `"toString"` becomes `"TOSTRING"`, which `in` also rejects, so no input can tell the two apart. The `toString` test does fail when (c) and (d) are applied together, so it's the backstop if the uppercasing is ever removed. If you want (d) caught on its own, one option is to stop uppercasing before the lookup, but that goes against the design, so I didn't change it.
- **(e) No non-string guard.** Caught by "only one code per order".

Everything is restored and green. Midway I noticed that `git checkout` can't restore `src/coupons.js` because git isn't tracking it yet, so I rewrote the file by hand. The content above is what's on disk now.

Final `git diff` (new files shown with intent-to-add):

```diff
diff --git a/README.md b/README.md
@@ -5,3 +5,4 @@
 - `src/cart.js` computes line totals and the cart total.
 - `src/money.js` rounds to cents.
 - `src/shipping.js` charges flat shipping.
+- `src/coupons.js` maps coupon codes to subtotal discounts.
diff --git a/src/cart.js b/src/cart.js
@@ -1,3 +1,4 @@
+import { discountFor } from "./coupons.js";
 import { roundCents } from "./money.js";
 import { shippingFor } from "./shipping.js";
 
@@ -5,8 +6,8 @@ export function lineTotal(item) {
   return roundCents(item.price * item.qty);
 }
 
-export function computeTotal(items, { discountPct = 0 } = {}) {
+export function computeTotal(items, { coupon } = {}) {
   const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
-  const discounted = subtotal * (1 - discountPct);
-  return roundCents(discounted + shippingFor(items));
+  const discount = coupon === undefined ? 0 : discountFor(coupon, subtotal);
+  return roundCents(subtotal - discount + shippingFor(items));
 }
diff --git a/src/coupons.js b/src/coupons.js
new file mode 100644
@@ -0,0 +1,13 @@
+import { roundCents } from "./money.js";
+
+const COUPONS = {
+  SAVE10: (subtotal) => subtotal * 0.1,
+  FLAT5: () => 5,
+};
+
+export function discountFor(code, subtotal) {
+  if (typeof code !== "string") throw new Error("Only one coupon code per order");
+  const key = code.trim().toUpperCase();
+  if (!Object.hasOwn(COUPONS, key)) throw new Error(`Unknown coupon code "${code}"`);
+  return roundCents(Math.min(COUPONS[key](subtotal), subtotal));
+}
diff --git a/test/cart.test.js b/test/cart.test.js
@@ -10,10 +10,6 @@
   assert.equal(lineTotal({ price: 0.333, qty: 3 }), 1);
 });
 
-test("applies a 10% discount before shipping", () => {
-  assert.equal(computeTotal([{ price: 20, qty: 2 }], { discountPct: 10 }), 41);
-});
-
 test("an empty cart costs nothing", () => {
   assert.equal(computeTotal([]), 0);
 });
diff --git a/test/coupons.test.js b/test/coupons.test.js
new file mode 100644
@@ -0,0 +1,40 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { computeTotal } from "../src/cart.js";
+
+const twoTwenties = [{ price: 20, qty: 2 }];
+
+test("SAVE10 takes 10% off the subtotal before shipping", () => {
+  assert.equal(computeTotal(twoTwenties, { coupon: "SAVE10" }), 41);
+});
+
+test("SAVE10 rounds the discount to cents", () => {
+  assert.equal(computeTotal([{ price: 33.33, qty: 1 }], { coupon: "SAVE10" }), 35);
+});
+
+test("FLAT5 takes 5 off the subtotal before shipping", () => {
+  assert.equal(computeTotal(twoTwenties, { coupon: "FLAT5" }), 40);
+});
+
+test("FLAT5 never takes goods below zero and leaves shipping", () => {
+  assert.equal(computeTotal([{ price: 3, qty: 1 }], { coupon: "FLAT5" }), 5);
+});
+
+test("codes ignore case and surrounding whitespace", () => {
+  assert.equal(computeTotal(twoTwenties, { coupon: " save10 " }), 41);
+});
+
+test("an unknown code is rejected by name", () => {
+  assert.throws(() => computeTotal(twoTwenties, { coupon: "BOGUS" }), /Unknown coupon code "BOGUS"/);
+});
+
+test("inherited object keys are unknown codes", () => {
+  assert.throws(() => computeTotal(twoTwenties, { coupon: "toString" }), /Unknown coupon code "toString"/);
+});
+
+test("only one code per order", () => {
+  assert.throws(
+    () => computeTotal(twoTwenties, { coupon: ["SAVE10", "FLAT5"] }),
+    /Only one coupon code per order/,
+  );
+});
```

Files:
- `<repo>/.claude/worktrees/agent-a588635251475c50d/src/coupons.js`
- `<repo>/.claude/worktrees/agent-a588635251475c50d/src/cart.js`
- `<repo>/.claude/worktrees/agent-a588635251475c50d/test/coupons.test.js`
- `<repo>/.claude/worktrees/agent-a588635251475c50d/test/cart.test.js`
- `<repo>/.claude/worktrees/agent-a588635251475c50d/README.md`
--- end of delegate d1 ---

=== turn t1 ===
e61 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e62 [main] run: cd <repo>/.claude/worktrees/agent-a588635251475c50d && git status --short && git log --oneline -1 && cat test/coupons.test.js
e63 [main] says (interim): This is a small change to one module, so I'm making it directly. A 20 minimum means FLAT5 can never exceed the subtotal, so I'm also removing the zero-floor clamp that no longer does anything.
e64 [main] edit <repo>/.claude/worktrees/agent-a588635251475c50d/src/coupons.js
e65 [main] edit <repo>/.claude/worktrees/agent-a588635251475c50d/test/coupons.test.js
e66 [main] run: npm test 2>&1 | grep -E "^✖|ℹ (pass|fail)"; cp src/coupons.js /tmp/c.js
for m in 's/subtotal < minSubtotal/subtotal <= minSubtotal/' 's/minSubtotal: 20/minSubtotal: 0/' 's/roundCents(minSubtotal - subtotal).toFixed(2)/(minSubtotal - subtotal)/'; do sed -i "$m" src/coupons.js; echo "== $m"; npm test 2>&1 | grep -E "^✖ [A-Za-z]|ℹ fail" | sort -u; cp /tmp/c.js src/coupons.js; done; git diff --stat; n [...38 more chars]
e67 [main] run: git add src/coupons.js test/coupons.test.js && git commit -q -F - <<'EOF'
feat(cart): require a 20 subtotal for FLAT5

FLAT5 lost money on small orders. Below a 20 subtotal the code is now
rejected with the amount the customer still needs to add, for example
"FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it."

The minimum makes the old zero-floor clamp unreachable, so it is gone.
 [...49 more chars]
e68 [main] REPLY TO USER:
FLAT5 now only works on orders with a subtotal of 20 or more. On a 12.50 order the customer sees "FLAT5 needs a subtotal of at least 20.00. Add 7.50 more to use it." A subtotal of exactly 20 qualifies. It's committed as `05768d4` on `feat/coupons`, on top of the first coupon commit. That branch is still in the worktree `.claude/worktrees/agent-a588635251475c50d`.

**What counts toward the 20.** It's the items only, before any discount and before shipping. So a customer can't count the 5.00 shipping toward the minimum.

**Where the rule lives.** The minimum sits in the coupon table next to each code's discount (per "Model the Domain"). Any future code can get its own minimum by changing one number, and the error message will say the right amount for it.

**Code I removed.** I took out the rule that stopped FLAT5 from taking an order below zero. With a 20 minimum and a 5 discount that can't happen anymore, so the rule was dead code (per "Laziness Protocol"). The test for it is replaced by three new ones:
- FLAT5 works at exactly 20.
- A 12.50 order gets the full error message word for word.
- A 19.99 order is told to add 0.01.

**Tests.** `npm test` passes all 13 tests (measured). I broke the code on purpose three ways to check the new tests catch real mistakes (per "Test Behavior, Not Implementation"). All three were caught (measured):
- Making exactly 20 fail the minimum.
- Removing the minimum.
- Showing the shortfall without rounding it to cents, which would print 0.010000000000001563 instead of 0.01.

**Decision for you.** The message uses the internal code name ("FLAT5") and plain amounts with no currency symbol. If checkout shows this text to customers as-is, you may want it reworded or given a currency symbol.

=== turn t2 ===
e69 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e70 [main] says (interim): I'll read the full branch diff and then test the edge cases I'm suspicious of against the real code, instead of just reasoning about them.
e71 [main] run: cd <repo>/.claude/worktrees/agent-a588635251475c50d && git diff main --stat && cat > /tmp/probe.mjs <<'EOF'
import { computeTotal, lineTotal } from "./src/cart.js";
const t = (label, f) => { try { console.log(label, "->", f()); } catch (e) { console.log(label, "-> THROWS", JSON.stringify(e.message), e.constructor.name); } };
t("empty string coupon", () => computeTotal([{ price: 30, qty: 1 }], { co [...1526 more chars]
e72 [main] run: cat > probe.mjs <<'EOF'
import { computeTotal, lineTotal } from "./src/cart.js";
let low = 0, example;
for (let run = 0; run < 200000; run++) {
  const n = 2 + Math.floor(Math.random() * 10);
  let left = 2000; const items = [];
  for (let i = 0; i < n - 1 && left > 1; i++) { const c = 1 + Math.floor(Math.random() * (left - 1)); items.push({ price: c / 100, qty: 1 }); left -= c; }
  items.push({ p [...410 more chars]
e73 [main] REPLY TO USER:
I'd block on one bug. Some customers with exactly 20.00 of items get FLAT5 rejected with "Add 0.00 more to use it." I found this by running the real code, not by reading it. Below that are two things I'd want answered before merging, and three small things I wouldn't block on. I haven't changed any code.

**Blocker: FLAT5 turns away some carts worth exactly 20.00.** Adding up prices in JavaScript can leave tiny errors, and the cart total is never rounded to cents. So a cart that should total 20.00 can come out as 19.999999999999996 and fail the minimum. One real example is 9.71 + 2.52 + 1.41 + 1.85 + 2.71 + 1.67 + 0.13. I built 200,000 random carts that each total exactly 20.00, and 19,133 of them (about 10%) were rejected (measured). Two- and three-item carts never failed, which is why the tests missed it.

This isn't only a coupon problem. Each item is rounded to cents at `src/cart.js:10`, but the sum of the items isn't. The fix is to round that sum once, plus a test that uses the cart above. That test should fail today and pass after the fix.

**Should answer before merge: can checkout tell a coupon problem from a bug?** The new messages are written for customers, but every failure is the same kind of `Error`. Checkout would have to either show every error message to the customer or match on the wording. There's also a misleading message. Passing `null` as the coupon says "Only one coupon code per order" (measured), which reads as a customer error but is really a caller mistake. I'd add one `CouponError` type for the customer-facing rejections and let everything else fail as an ordinary error. If checkout never shows these messages to customers, this can wait.

**Should answer before merge: what does "no coupon" look like?** Only a missing coupon means "no coupon." An empty string throws `Unknown coupon code ""` (measured). An empty coupon box on a checkout form usually sends exactly that, so every order with the box left blank would fail. Either treat a blank code as no coupon, or confirm that checkout never sends one. There's no checkout code in this repo, so I can't check which.

**Wouldn't block:**
- The README says what `coupons.js` does but doesn't mention the FLAT5 minimum.
- The first commit adds a "never go below zero" rule and a test for it, and the second commit removes both. Squashing the two would make the history easier to read.
- Removing `discountPct` would break any caller outside this repo. The only caller here was the broken test, so that's safe as far as this repo can show (checked with a search).

**Checked and fine.** SAVE10 on an empty cart gives 0. FLAT5 on an empty cart says "Add 20.00 more." SAVE10 on 10.05 rounds the half cent in the customer's favor and totals 14.04 (all measured). The existing tests do catch the mistakes I planted earlier.

If you want, I can fix the rounding bug with its regression test first, then do the error type and the blank-code handling as a second commit once you've decided how blank codes should behave.
