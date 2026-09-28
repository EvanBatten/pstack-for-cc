=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i lock) 2>/dev/null | head -300; cat "<pstack>/poteto-mode/playbooks/bug-fix.md"
e3 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)
e4 [main] run: npm test 2>&1 | grep -E "^(not ok|ok|# )|expected|actual" ; node -e 'import("./src/cart.js").then(m=>console.log("all-zero cart total:", m.computeTotal([{price:2.5,qty:0},{price:1,qty:0}])))'; S="<pstack>"; cat $S/principle-fix-root-causes/SKILL.md $S/principle-test-behavior-not-implementation/SKILL.md | head -120; git log -p --follow src/shipping.js | head -40
e5 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (partial)
e6 [main] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (partial)
e7 [main] says (interim): Reproduced: an all-zero cart totals 5. The suite also has an unrelated failing test (the discount case returns -355). Next I'll branch, add the failing regression test, and commit it before the fix.
e8 [main] run: git remote -v; git checkout -b fix/no-shipping-on-zero-qty-cart && cat >> test/cart.test.js <<'EOF'

test("a cart whose quantities are all zero costs nothing", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 0 }, { price: 1, qty: 0 }]), 0);
});
EOF
node --test 2>&1 | grep -E "^not ok|^# (pass|fail)|actual|expected"
e9 [main] run: git add test/cart.test.js && git commit -q -m "test: zero-quantity cart should not be charged shipping

Fails today: a cart of items all at qty 0 totals 5 because shipping
is charged whenever the item list is non-empty.

Co-authored-by: <agent>" && cat > src/shipping.js <<'EOF'
export const FLAT_SHIPPING = 5;

export function shippingFor(items) {
  return items.some((item) => item.qty > 0) ? FLAT_ [...276 more chars]
e10 [main] run: node --test --test-reporter=tap 2>&1 | grep -E "^(not )?ok|^# (pass|fail)"; git stash -q && node --test --test-reporter=tap 2>&1 | grep -E "zero|^# (pass|fail)"; git stash pop -q && git diff --stat
e11 [main] run: git commit -qam "fix: skip shipping when no item has a positive quantity

shippingFor charged the flat rate whenever the items array was
non-empty. Setting every quantity to 0 leaves the lines in the
array, so an order with nothing in it was still charged 5.
Charge shipping only when some item has qty > 0.

Co-authored-by: <agent>" && git log --oneline -3
e12 [main] REPLY TO USER:
Customers who empty their cart by setting every quantity to 0 are no longer charged shipping. Checkout now totals 0 for that order. The fix is on branch `fix/no-shipping-on-zero-qty-cart` in two commits. The repo has no git remote, so I didn't open a PR.

**Cause.** `shippingFor` in `src/shipping.js` charged the flat 5 whenever the item list was non-empty. Setting a quantity to 0 leaves the item in the list, so the cart still looked like it had something in it. I reproduced it before changing anything. `computeTotal([{price:2.5,qty:0},{price:1,qty:0}])` returned `5`.

**Fix.** Shipping is now charged only when at least one item has a quantity above 0. It's a one-line change in `shippingFor`. The next person working on shipping should know that it now reads quantities, not just whether the list is empty.

**Verification.**
- The new test ("a cart whose quantities are all zero costs nothing") is committed before the fix. I ran it against both versions of the code:
  - Without the fix it fails with `actual: 5, expected: 0`.
  - With the fix it passes, and `computeTotal` returns `0` for the all-zero cart.
- A mixed cart (one line at 0, one at 3 × 1) still gets shipping and totals `8`.
- The existing flat-shipping and empty-cart tests still pass.

**A separate bug is still there.** The test "applies a 10% discount before shipping" was already failing on `main` before my change, and it still fails (`actual: -355, expected: 41`). The test passes `discountPct: 10`, but `computeTotal` treats the value as a fraction, so the 40 subtotal gets multiplied by -9. I didn't fix it because I can't tell from the repo which is wrong. If the test is right, the code should divide by 100. If callers already pass `0.1`, the test is wrong. My guess is the code, since the option is named `discountPct` and the commit says "percentage discounts", but I haven't checked any callers. Either way it's a pricing error that can reach customers. There's no issue tracker here, so it needs tracking somewhere.

How the principles shaped this:
- **Fix Root Causes** put the fix in `shippingFor`, where the wrong rule lives. The alternative was dropping zero-quantity lines inside `computeTotal`, which would have left `shippingFor` wrong for any other caller.
- **Test Behavior, Not Implementation** is why I ran the new test with the fix removed and confirmed it fails. It also shaped the assertion, which checks the total the customer pays rather than the output of `shippingFor`.

I made the one-line change myself rather than handing it to a subagent, because it was too small to be worth one.
