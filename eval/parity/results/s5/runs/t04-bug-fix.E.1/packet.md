=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i readme | head -20); cat "<pstack>/poteto-mode/playbooks/bug-fix.md"
e3 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)
e4 [main] run: npm test 2>&1 | grep -E "^(not ok|ok|# )|expected|actual" ; node -e 'import("./src/cart.js").then(m=>console.log("all-zero cart total:", m.computeTotal([{price:2.5,qty:0},{price:1,qty:0}])))'; git remote -v; P=<pstack>; cat $P/principle-fix-root-causes/SKILL.md $P/principle-test-behavior-not-implementation/SKILL.md | head -80
e5 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (partial)
e6 [main] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (partial)
e7 [main] run: git checkout -q -b fix/no-shipping-for-zero-qty && cat >> test/cart.test.js <<'EOF'

test("a cart whose every quantity is zero costs nothing", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 0 }, { price: 1, qty: 0 }]), 0);
});

test("zero-quantity lines don't affect shipping for the rest", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 0 }, { price: 1, qty: 3 }]), 8);
});
EOF
npm [...62 more chars]
e8 [main] run: npm test 2>&1 | grep -B2 -A12 "not ok" | head -60
e9 [main] run: node --test 2>&1 | grep -E "✖|✔|ℹ (pass|fail)" | sort -u
e10 [main] says (interim): The new regression test fails as expected (`actual: 5, expected: 0`). Committing it before the fix.
e11 [main] run: git add test/cart.test.js && git commit -q -F - <<'EOF'
Add failing test for shipping on an all-zero-quantity cart

A cart whose lines all have qty 0 is charged the flat 5 shipping fee.

Co-authored-by: <agent>
EOF
sed -i 's/return items.length > 0 ? FLAT_SHIPPING : 0;/return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;/' src/shipping.js && cat src/shipping.js && node --test 2>&1 | grep [...165 more chars]
e12 [main] run: git add src/shipping.js && git commit -q -F - <<'EOF'
Charge shipping only when something is being bought

shippingFor counted cart rows, so a cart whose lines were all set to
qty 0 still paid the flat fee. Charge shipping when any line has a
positive quantity.

Co-authored-by: <agent>
EOF
git log --oneline -3
e13 [main] REPLY TO USER:
Customers who zero out every line in their cart now pay 0 at checkout instead of 5.

**Root cause.** `shippingFor` in `src/shipping.js` checked `items.length > 0`. That counts cart rows, not what's being bought. Setting every quantity to 0 left the rows in place, so the flat fee still applied. The **Fix Root Causes** principle meant fixing that rule in `shippingFor`. I didn't add a checkout guard that strips zero-quantity rows. Nothing else in `src/` makes a decision based on how many rows the cart has.

**Fix.** Shipping is now charged only when at least one line has a positive quantity: `items.some((item) => item.qty > 0)`. It's a one-line change.

**Verification.** I reproduced the bug before touching any code. `computeTotal` on two lines at qty 0 returned `5`. The **Test Behavior, Not Implementation** principle shaped the regression tests. Both go through `computeTotal` and check the total the customer pays, rather than calling `shippingFor` directly:
- A cart whose every quantity is zero costs 0.
- A zero-quantity line next to a real one still gets shipping, which catches a fix that goes too far.

I committed the tests on their own first, and the zero-cart test failed with `actual: 5, expected: 0`. After the fix, the same repro returns `0` and the suite is 5 pass, 1 fail. The branch is `fix/no-shipping-for-zero-qty`, with the test commit `c49ae89` before the fix `66afda4`. I didn't open a PR because the repo has no git remote.

**Remaining failure.** The one failing test, "applies a 10% discount before shipping", was already failing on `main` before I changed anything. It reports `actual: -355, expected: 41`. `computeTotal` treats `discountPct` as a fraction, but the test passes `10`, so the total becomes 40 × (1 − 10) + 5. That's a real pricing bug from `ff910e0`, and it's separate from this one, so I left it alone. You need to decide whether `discountPct` means `10` or `0.1` before it can be fixed. Either way, it should get its own issue.
