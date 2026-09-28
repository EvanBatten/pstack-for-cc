=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i lock) 2>/dev/null | head -300; cat "<pstack>/poteto-mode/playbooks/feature.md"
e3 [main] read <pstack>/poteto-mode/playbooks/feature.md (full)
e4 [main] run: npm test 2>&1 | tail -30; git log -p --stat -3 | head -120; git remote -v
e5 [main] run: cd "<pstack>" && for s in principle-model-the-domain principle-boundary-discipline principle-test-behavior-not-implementation principle-redesign-from-first-principles principle-fix-root-causes; do echo "=== $s"; cat $s/SKILL.md; done
e6 [main] read <pstack>/poteto-mode/principles/model-the-domain.md (full)
e7 [main] read <pstack>/poteto-mode/principles/boundary-discipline.md (full)
e8 [main] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e9 [main] read <pstack>/poteto-mode/principles/redesign-from-first-principles.md (full)
e10 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e11 [main] run: git switch -c coupon-codes && echo todo.md >> .git/info/exclude && cat > todo.md <<'EOF'
# Feature: coupon codes
1. [x] `how` over the affected subsystem. skip: the subsystem is 3 files / 20 lines, read in full directly.
2. [x] `architect` for parallel design exploration. skip: one obvious shape (code -> Discount registry); no competing shapes worth a panel.
3. [x] Throughput checkpoint
   - Block [...694 more chars]
e12 [main] spawn other delegate, model tier top, foreground. Brief: Repo: a tiny Node ESM cart-pricing module (src/cart.js, src/money.js, src/shipping.js, test/cart.test.js; `npm test` = `node --test`). Read all four files first. Work on the branch you are in, starting from branch `coupon-codes` (currently equal to main). Make exactly two commits. No code comments unless a non-obvious why. Match the existing terse style.

Commit 1: "treat discountPct as a percentage". Pre-existing bug: `computeTotal` does `subtotal * (1 - discountPct)`, but the param name, the test name "applies a 10% discount", and its expected value 41 (40 * 0.9 + 5) all say discountPct is in percent units. Suite is red on main (-355 !== 41). Fix it at the root by routing it through the percent discount below (or divide by 100 if you do commit 1 standalone first). Suite must go green.

C [...2393 more chars]
e13 [main] says (interim): The delegate finished. I'm reviewing its diff and rerunning the suite myself now.
e14 [main] run: git diff main worktree-agent-ad4fcf9f7afc4a340 && git log --oneline main..worktree-agent-ad4fcf9f7afc4a340
e15 [main] run: git worktree remove .claude/worktrees/agent-ad4fcf9f7afc4a340 && git merge --ff-only worktree-agent-ad4fcf9f7afc4a340 && git branch -d worktree-agent-ad4fcf9f7afc4a340 && python - <<'EOF'
p='test/coupons.test.js'
s=open(p).read()
s=s.replace('''test("inherited object keys are not coupon codes", () => {
  assert.throws(() => couponFor("toString"), UnknownCouponError);
});

''','').replace('import { [...199 more chars]
e16 [main] says (interim): I'll spot-check one mutation myself rather than trust the delegate's report.
e17 [main] run: sed -i 's/Math.max(0, \(APPLY\[discount.kind\](subtotal, discount)\))/\1/' src/coupons.js && npm test 2>&1 | grep -E "^✖|fail " ; git checkout -q src/coupons.js && sed -i 's/if (Array.isArray(coupon)) throw.*$//' src/cart.js && npm test 2>&1 | grep -E "^✖|fail "; git checkout -q src/cart.js; git status --short; git commit --amend -q -m "add SAVE10 and FLAT5 coupon codes" -m "Co-authored-by: <agent [...70 more chars]
e18 [main] REPLY TO USER:
Coupon codes are in, on the local branch `coupon-codes` in two commits. All 11 tests pass. I haven't opened a PR because the repo has no remote.

For checkout customers, `computeTotal(items, { coupon: "SAVE10" })` takes 10% off the goods and `FLAT5` takes 5 off. Both apply before shipping, the same way the existing discount does. Codes ignore case and surrounding spaces, so " save10 " works. An unknown code throws an `UnknownCouponError` whose message names the code, for example `Unknown coupon code "BOGUS"`. The code is also on `err.code`, so the checkout page can show it. FLAT5 on a cart worth less than 5 brings the goods to zero, never below, so the customer still pays shipping. For the next maintainer, all discount logic now lives in `src/coupons.js`. Adding a code is one line in the `COUPONS` table.

**A bug you should know about.** Before I started, `npm test` was already failing on `main` (measured: `-355 !== 41`). `discountPct: 10` was treated as 10.0, not 10%, so the total went negative. Anyone calling it with a real percentage would have produced a negative total. The first commit (`0579108`) fixes that, and the coupon commit then sends `discountPct` through the same discount code as the coupons. Any caller that was passing a fraction like `0.1` will now get 0.1% off instead of 10%. That is a guess about callers outside this repo, since I can't see them.

**Design choices and the principles behind them:**
- **Model the Domain.** A discount is either a percentage or a flat amount. Codes map to discounts through one frozen table, so there is no if/else chain that grows with each new code.
- **Boundary Discipline.** Cleaning up and checking the typed code happens once, in `couponFor`. `applyDiscount` is a plain calculation with no checks.
- **Redesign from First Principles.** Instead of adding coupons alongside the old discount math, `discountPct` became one more percentage discount. That is how the bug fix and the feature ended up sharing one code path.
- **Test Behavior, Not Implementation.** A subagent wrote the code, and it checked each new test by breaking the code that test protects. I reran two of those breaks myself: removing the zero floor and removing the one-code check each failed exactly their own test (measured). I deleted one test it wrote, the "toString" check. Its own run showed that test caught nothing on its own, because uppercasing the code already rejects "toString".

**Planning notes.** No parallel work was needed because it's one module plus its test. The only thing that had to come first was fixing the broken discount so the suite was green. A single worker was enough because `cart.js` and `coupons.js` change together. I skipped the `how`, `architect` and `interrogate` steps because the whole module is about 20 lines, which I read in full, and the design had one obvious shape. I didn't run formal `deslop` and `no-comments` passes. The diff has no comments and I reviewed every line.

**Decisions for you:**
- **One code per order.** `coupon` takes a single string. Passing a list throws "Only one coupon code is allowed per order".
- **Coupon plus `discountPct`.** I chose to reject using both at once ("A coupon and discountPct cannot be combined"). Letting them stack would give away more than either discount intends, and rejecting is easy to reverse. Say "stack" and I'll apply both one after the other instead.

--- delegate d1 (other, spawned at e12) ---
e19 [d1] BRIEF RECEIVED: Repo: a tiny Node ESM cart-pricing module (src/cart.js, src/money.js, src/shipping.js, test/cart.test.js; `npm test` = `node --test`). Read all four files first. Work on the branch you are in, starting from branch `coupon-codes` (currently equal to main). Make exactly two commits. No code comments unless a non-obvious why. Match the existing terse style.

Commit 1: "treat discountPct as a percentage". Pre-existing bug: `computeTotal` does `subtotal * (1 - discountPct)`, but the param name, the test name "applies a 10% discount", and its expected value 41 (40 * 0.9 + 5) all say discountPct is in percent units. Suite is red on main (-355 !== 41). Fix it at the root by routing it through the percent discount below (or divide by 100 if you do commit 1 standalone first). Suite must go green.

C [...2393 more chars]
e20 [d1] invoke skill poteto-mode, which loads <pstack>/poteto-mode/SKILL.md in full
e21 [d1] run: git status && git log --oneline -3 && cat src/cart.js src/money.js src/shipping.js test/cart.test.js README.md package.json
e22 [d1] run: cd <pstack> && cat principle-model-the-domain/SKILL.md principle-boundary-discipline/SKILL.md principle-test-behavior-not-implementation/SKILL.md | head -200
e23 [d1] read <pstack>/poteto-mode/principles/model-the-domain.md (partial)
e24 [d1] read <pstack>/poteto-mode/principles/boundary-discipline.md (partial)
e25 [d1] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (partial)
e26 [d1] run: npm test 2>&1 | grep -E "^# (pass|fail)|!==" ; sed -i 's|subtotal \* (1 - discountPct)|subtotal * (1 - discountPct / 100)|' src/cart.js && npm test 2>&1 | grep -E "^# (pass|fail)" && git add src/cart.js && git commit -qm "treat discountPct as a percentage

Co-authored-by: <agent>" && git log --oneline -1
e27 [d1] run: cat src/cart.js; npm test 2>&1 | tail -12
e28 [d1] says (interim): Output format uses `ℹ`, not `#`. Green; committing.
e29 [d1] run: git add src/cart.js && git commit -qm "treat discountPct as a percentage

Co-authored-by: <agent>" && git log --oneline -1
e30 [d1] run: cat > src/coupons.js <<'EOF'
export const COUPONS = Object.freeze({
  SAVE10: Object.freeze({ kind: "percent", pct: 10 }),
  FLAT5: Object.freeze({ kind: "flat", amount: 5 }),
});

export class UnknownCouponError extends Error {
  constructor(code) {
    super(`Unknown coupon code "${code}"`);
    this.name = "UnknownCouponError";
    this.code = code;
  }
}

export function couponFor(code) {
  co [...3110 more chars]
e31 [d1] says (interim): I'll use Write for the files instead.
e32 [d1] edit <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/src/coupons.js
e33 [d1] edit <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/src/cart.js
e34 [d1] edit <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/test/coupons.test.js
e35 [d1] read <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/README.md (full)
e36 [d1] edit <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/README.md
e37 [d1] run: npm test 2>&1 | grep -E "^(✖|ℹ (tests|pass|fail))"
e38 [d1] says (interim): Tests are green. Next I'll build a mutation runner so every mutation is applied, tested, and restored the same way.
e39 [d1] edit <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/mutate.mjs
e40 [d1] run: node mutate.mjs
e41 [d1] edit <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/mutate.mjs
e42 [d1] run: node mutate.mjs | grep hasOwn
e43 [d1] says (interim): The runner restores each file after every mutation. I'll delete the runner, confirm the source matches what I wrote, and commit.
e44 [d1] run: rm mutate.mjs && git status --short && git diff --stat && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
e45 [d1] run: git add README.md src/cart.js src/coupons.js test/coupons.test.js && git commit -qm "add SAVE10 and FLAT5 coupon codes

Co-authored-by: <agent>" && git log --oneline -3 && git branch --show-current && git status --short
e46 [d1] FINAL MESSAGE TO PARENT:
Checkout customers can now enter SAVE10 or FLAT5, and a `discountPct` of 10 now takes 10% off instead of making the total negative. Both commits are made and `npm test` passes all 12 tests (4 existing, 8 new).

The commits are on branch `worktree-agent-ad4fcf9f7afc4a340`, not `coupon-codes`. That is the branch this worktree was created on, and it started at the same commit as `coupon-codes` (ff910e0). Fast-forward `coupon-codes` to 38c0d25 if you want the commits there.

- **0579108 "treat discountPct as a percentage".** Before this, the suite failed on the 10% test with -355 !== 41. I made the one-line fix of dividing by 100 in `computeTotal`, and all 4 tests passed.
- **38c0d25 "add SAVE10 and FLAT5 coupon codes".** `src/coupons.js` holds the frozen code registry, `UnknownCouponError`, `couponFor` and `applyDiscount`. `applyDiscount` works from a small table keyed by discount kind, so there is no if/else to grow. `computeTotal` now sends both `discountPct` and coupons through `applyDiscount`, so the fix from the first commit lives in one place. The README lists the new file.

**Design choices:**
- **Model the Domain.** Adding a code is one registry line, and adding a new kind of discount is one table entry.
- **Boundary Discipline.** All checks on what the caller passes in (array, both discounts at once, unknown code) happen once in `computeTotal` and `couponFor`. `applyDiscount` does no checking.
- **Test Behavior, Not Implementation.** Every new test goes through `computeTotal` or `couponFor` and checks a hand-computed total or the exact error.

**Mutations.** A throwaway script applied each break, ran the suite and restored the file. I deleted it afterwards. 11 of 12 breaks made at least one test fail:
- **Removing the clamp at 0** failed "FLAT5 never makes the goods negative".
- **Removing trim, or removing uppercasing,** failed the " save10 " test.
- **Throwing a plain `Error` for unknown codes** failed both the unknown-code test and the "toString" test.
- **Leaving the code out of the error message** failed the unknown-code test.
- **Using `pct` instead of `pct / 100`** failed both 10% tests and the " save10 " test.
- **Ignoring the flat amount** failed both FLAT5 tests.
- **Removing the array check** failed the one-code-per-order test.
- **Removing the no-combining check** failed the no-combining test.
- **Applying the discount after shipping** failed 4 tests.
- **Swapping `Object.hasOwn` for `in` and also removing uppercasing** failed the "toString" test and the " save10 " test.

**The one that passed.** Swapping `Object.hasOwn` for `in` on its own broke nothing. Uppercasing turns "toString" into "TOSTRING", and no built-in object key is all capitals, so today uppercasing alone already rejects "toString". The "toString" test therefore only guards `Object.hasOwn` if uppercasing is ever removed. I kept the test because you asked for it and it states the intended behavior.

Files:
- <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/src/coupons.js
- <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/src/cart.js
- <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/test/coupons.test.js
- <repo>/.claude/worktrees/agent-ad4fcf9f7afc4a340/README.md
--- end of delegate d1 ---

=== turn t1 ===
e47 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e48 [main] says (interim): Small change, but it touches the registry, the cart and the tests, so I'll run it through the same delegate-and-review loop.
e49 [main] spawn other delegate, model tier top, foreground. Brief: Repo: tiny Node ESM cart module. Start from branch `coupon-codes` (HEAD 49f91f7); make sure your worktree is on that commit before editing (`git reset --hard coupon-codes` if it isn't). Read src/cart.js, src/coupons.js, src/money.js, test/coupons.test.js first. One commit, message "require a 20 subtotal for FLAT5" followed by a blank line and "Co-authored-by: <agent>". No code comments. Match the terse existing style.

Requirement: FLAT5 is only accepted when the order subtotal (sum of rounded lines, before shipping) is at least 20. Below that, reject with an error telling the customer how much more they need to add.

Design (follow it):
- Registry carries the rule as data: `FLAT5: { kind: "flat", amount: 5, minSubtotal: 20 }`. SAVE10 has no minSubtotal. No code-name branching anywhere.
-  [...1562 more chars]
e50 [main] run: git diff coupon-codes worktree-agent-a276284518f3b986c -- src && git worktree remove .claude/worktrees/agent-a276284518f3b986c && git merge -q --ff-only worktree-agent-a276284518f3b986c && git branch -q -d worktree-agent-a276284518f3b986c && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)" && sed -i 's/if (discount.minSubtotal !== undefined \&\& subtotal < discount.minSubtotal)/if (false)/' src/coup [...127 more chars]
e51 [main] REPLY TO USER:
FLAT5 now only applies when the order subtotal is at least 20. A customer below that gets an error saying how much more to add, for example "FLAT5 needs a subtotal of at least 20.00. Add 4.50 more to use it." Exactly 20 is accepted. The subtotal is the goods before shipping, the same amount FLAT5 comes off. The change is one more commit, `304976c`, on the local `coupon-codes` branch, and all 15 tests pass.

The checkout page can build its own wording from the error. It's a `CouponMinimumError` with the code, the minimum and the shortfall as separate fields.

**Design choices and the principles behind them:**
- **Model the Domain.** The minimum is stored as data on FLAT5's entry in the coupon table (`minSubtotal: 20`), not written as a special case for FLAT5 in the code. Giving another coupon a minimum is one field on its entry.
- **Boundary Discipline.** `couponFor` now takes the subtotal and is the only place the minimum is checked.
- **Test Behavior, Not Implementation.** A subagent wrote the change. It checked each new test by breaking the code that test protects, and every break was caught. I reran one myself: deleting the minimum check failed both below-minimum tests. One test covers a subtotal of 19.99. It checks the shortfall is exactly 0.01, because plain subtraction gives 0.010000000000001563.

The earlier test that FLAT5 never pushes the goods below zero can't happen through checkout anymore, because the minimum (20) is above the discount (5). I kept the zero floor as a guard for any future flat coupon without a minimum, and moved its test to call `applyDiscount` directly.

**Decision for you.** SAVE10 still has no minimum. Adding one is a single field if you want it.

--- delegate d2 (other, spawned at e49) ---
e52 [d2] BRIEF RECEIVED: Repo: tiny Node ESM cart module. Start from branch `coupon-codes` (HEAD 49f91f7); make sure your worktree is on that commit before editing (`git reset --hard coupon-codes` if it isn't). Read src/cart.js, src/coupons.js, src/money.js, test/coupons.test.js first. One commit, message "require a 20 subtotal for FLAT5" followed by a blank line and "Co-authored-by: <agent>". No code comments. Match the terse existing style.

Requirement: FLAT5 is only accepted when the order subtotal (sum of rounded lines, before shipping) is at least 20. Below that, reject with an error telling the customer how much more they need to add.

Design (follow it):
- Registry carries the rule as data: `FLAT5: { kind: "flat", amount: 5, minSubtotal: 20 }`. SAVE10 has no minSubtotal. No code-name branching anywhere.
-  [...1562 more chars]
e53 [d2] invoke skill poteto-mode, which loads <pstack>/poteto-mode/SKILL.md in full
e54 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && git status --short && git log --oneline -1 && git rev-parse coupon-codes && cat src/cart.js src/coupons.js src/money.js test/coupons.test.js package.json && ls test
e55 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && cat test/cart.test.js src/shipping.js && cat <pstack>/poteto-mode/principles/test-behavior-not-implementation.md | head -60
e56 [d2] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (full)
e57 [d2] says (interim): Now the edits.
e58 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && cat > src/coupons.js <<'EOF'
import { roundCents } from "./money.js";

export const COUPONS = Object.freeze({
  SAVE10: Object.freeze({ kind: "percent", pct: 10 }),
  FLAT5: Object.freeze({ kind: "flat", amount: 5, minSubtotal: 20 }),
});

export class UnknownCouponError extends Error {
  constructor(code) {
    super(`Unknown coupon code "${c [...3204 more chars]
e59 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/src/coupons.js
e60 [d2] read <repo>/.claude/worktrees/agent-a276284518f3b986c/src/cart.js (full)
e61 [d2] read <repo>/.claude/worktrees/agent-a276284518f3b986c/test/coupons.test.js (partial)
e62 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/src/cart.js
e63 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/src/cart.js
e64 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/src/cart.js
e65 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/test/coupons.test.js
e66 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/test/coupons.test.js
e67 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && npm test 2>&1 | tail -9
e68 [d2] says (interim): Green at 15/15. Now a mutation script that applies each break, runs the suite, and restores the original bytes.
e69 [d2] edit <repo>/.claude/worktrees/agent-a276284518f3b986c/mutate.tmp.mjs
e70 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && node mutate.tmp.mjs
e71 [d2] says (interim): All 8 mutants were killed. Next I'll remove the script, confirm the tree is clean apart from my changes, and commit.
e72 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && rm mutate.tmp.mjs && git status --short && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
e73 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && git add src/cart.js src/coupons.js test/coupons.test.js && git commit -q -F - <<'EOF'
require a 20 subtotal for FLAT5

Co-authored-by: <agent>
EOF
e74 [d2] run: cd <repo>/.claude/worktrees/agent-a276284518f3b986c && git log -2 --format="%H %P%n%B" && git branch --show-current && git show --stat HEAD | tail -4
e75 [d2] FINAL MESSAGE TO PARENT:
FLAT5 now requires an order subtotal of at least 20. Below that, checkout throws a `CouponMinimumError` telling the customer how much more to add, for example "FLAT5 needs a subtotal of at least 20.00. Add 4.50 more to use it." `npm test` passes 15 of 15 after the commit, and all 8 deliberate breaks made at least one test fail.

The commit is `304976cce14d428d980b87cc95e47bf013c9efe6`, with the requested message and trailer. Its parent is 49f91f7, the `coupon-codes` HEAD. It is on the worktree branch `worktree-agent-a276284518f3b986c`, not on `coupon-codes`. That is the branch the worktree was created on, so `coupon-codes` needs a fast-forward to this SHA if you want the change there. It touches 3 files, adding 59 lines and removing 9.

- **Coupons.** The rule is data in the registry: `FLAT5: { kind: "flat", amount: 5, minSubtotal: 20 }`, and SAVE10 has none. No code checks for a specific coupon name. `couponFor(code, subtotal)` is the only place the minimum is checked. Exactly 20 is accepted.
- **Error.** The error's `code` is the normalized code, and `shortfall` is `roundCents(minSubtotal - subtotal)`.
- **Cart.** `discountFor` in `src/cart.js` now passes the subtotal to `couponFor`.
- **Clamp.** The `Math.max(0, ...)` floor in `applyDiscount` is unchanged.

Tests (principle-test-behavior-not-implementation shaped them):
- **Replaced test.** "FLAT5 never makes the goods negative" is now a direct `applyDiscount(3, { kind: "flat", amount: 5 }) === 0` check.
- **Below the minimum.** A subtotal of 3 with " flat5 " throws the new error with the exact 17.00 message, `code` "FLAT5", `minSubtotal` 20 and `shortfall` 17. The padded lowercase input also proves the error reports the normalized code.
- **One cent short.** A subtotal of 19.99 gives `shortfall === 0.01` and the message "Add 0.01 more".
- **Boundary and SAVE10.** A subtotal of exactly 20 totals 20. SAVE10 on a subtotal of 10 totals 14. The existing FLAT5-on-40 test still gives 40.

Mutation results. I used a throwaway script that applied each break, ran the suite, restored the file and was deleted afterwards. Every mutant was killed:
- **`<` to `<=`.** Failed "accepted at exactly 20".
- **Dropping `roundCents` on the shortfall.** Failed "one cent short". Only the exact `shortfall === 0.01` check catches this one, because `toFixed(2)` already turns 0.010000000000001563 into "0.01" in the message.
- **Dropping the minimum check, removing `minSubtotal` from FLAT5, or cart not passing the subtotal.** Each failed both below-minimum tests.
- **Adding `minSubtotal: 20` to SAVE10.** Failed "SAVE10 has no minimum subtotal".
- **Putting the raw code in the error instead of the normalized one.** Failed the 17.00 test.
- **Removing the `Math.max` clamp.** Failed the direct `applyDiscount` test.

Files:
- `<repo>/.claude/worktrees/agent-a276284518f3b986c/src/coupons.js`
- `<repo>/.claude/worktrees/agent-a276284518f3b986c/src/cart.js`
- `<repo>/.claude/worktrees/agent-a276284518f3b986c/test/coupons.test.js`
--- end of delegate d2 ---

=== turn t2 ===
e76 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e77 [main] says (interim): I'll review the whole branch diff against `main` fresh, and run the edge cases rather than reason about them.
e78 [main] run: git diff --stat main..coupon-codes && cat src/cart.js src/coupons.js && node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
const tryIt = (label, f) => { try { console.log(label, "->", f()); } catch (e) { console.log(label, "-> THROWS", e.name, JSON.stringify(e.message)); } };
const forty=[{price:20,qty:2}];
tryIt("coupon \"\" (empty form field)", () => computeTotal(forty,  [...910 more chars]
e79 [main] REPLY TO USER:
I'd block this branch on three things. I found each by running the code. Two are bugs I introduced, and one is a call I made that wasn't mine to make.

**Blocking:**

1. **A cart worth exactly 20.00 can be refused FLAT5, with the message "Add 0.00 more".** I reproduced this with lines of 0.02, 16.08 and 3.90. Adding them in floating point gives 19.999999999999996, which fails the `< 20` check. Many three-line carts that total exactly 20.00 hit the same problem (measured). The real cause is that `computeTotal` adds up line totals that are already rounded to cents without rounding the sum again. The 19.99 test I added covers the shortfall arithmetic but not this. The fix is to round the subtotal once in `computeTotal` (or work in integer cents), plus a regression test using that cart.

2. **The `discountPct` fix could silently overcharge existing customers.** In commit `ff910e0`, Dana's code treated the value as a fraction while the test treated it as a percent. That test failed the day it was written. I sided with the test. But any caller already passing `0.1` was getting a correct 10% off. On this branch, that same call returns 44.96 instead of 41 (measured). So such a customer would now get 0.1% off with no error. I can't see callers outside this repo, so whether any exist is a guess. That makes it a question for Dana, not something to decide in review. The options are:
   - Dana confirms percent units and callers are checked.
   - We keep fraction units and fix the test instead.
   - We rename the parameter, so old callers fail loudly instead of silently.

   Whichever wins, `package.json` is still at 0.3.0, and a change in what a parameter means should come with a version bump.

3. **An empty coupon field throws an error.** `coupon: ""` and `coupon: "   "` both throw `UnknownCouponError` (measured). If the checkout form sends an empty string when nobody types a code, every order without a coupon fails. I'm inferring that from how forms usually behave, since no caller exists in this repo. The fix is one line that treats a blank code as no coupon, plus a test. The downside is severe enough that I'd block rather than wait to see how checkout calls it.

**Worth fixing, but not blocking:**

- **`coupon: null` crashes** with a raw `TypeError` from `.trim()` (measured), not a readable error.
- **The one-code-per-order and cannot-combine errors are plain `Error`s.** The checkout page can only tell them apart by matching the message text, while the other two coupon errors have their own classes.
- **The two coupon error classes are inconsistent.** `UnknownCouponError.code` holds the code as typed, while `CouponMinimumError.code` holds it cleaned up (trimmed and uppercased).

**What I'd approve as is.** The coupon table design holds up, and each rule is checked in one place. Every test compares against a hand-computed value and has been shown to fail when the code it protects is broken.

I haven't changed anything, since you asked for a review. Say "fix" and I'll do items 1 and 3 plus the non-blocking ones, each as its own commit. Item 2 needs Dana's answer. I can draft that question for you.
