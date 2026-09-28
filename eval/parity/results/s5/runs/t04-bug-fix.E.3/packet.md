=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i lock) 2>/dev/null | head -300; cat "<pstack>/poteto-mode/playbooks/bug-fix.md"
e3 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)
e4 [main] run: npm test 2>&1 | tail -30; git remote -v; P="<pstack>"; cat $P/principle-fix-root-causes/SKILL.md $P/principle-test-behavior-not-implementation/SKILL.md $P/principle-laziness-protocol/SKILL.md | head -150
e5 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (partial)
e6 [main] read <pstack>/poteto-mode/principles/test-behavior-not-implementation.md (partial)
e7 [main] read <pstack>/poteto-mode/principles/laziness-protocol.md (partial)
e8 [main] run: node -e 'import("./src/cart.js").then(m=>console.log(m.computeTotal([{price:2.5,qty:0},{price:1,qty:0}])))'
e9 [main] says (interim): Reproduced: two lines at quantity 0 total 5. `shippingFor` decides on `items.length`, so zero-quantity lines still count as a shipment. Failing test first.
e10 [main] run: cat >> test/cart.test.js <<'EOF'

test("a cart whose lines are all zero quantity costs nothing", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 0 }, { price: 1, qty: 0 }]), 0);
});
EOF
node --test 2>&1 | grep -E "^(✖|ℹ (pass|fail))|!=="; git add test/cart.test.js && git commit -qm "test: zero-quantity cart should not charge shipping

Co-authored-by: <agent>" && git log --oneline -1
e11 [main] run: sed -i 's/return items.length > 0 ? FLAT_SHIPPING : 0;/return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;/' src/shipping.js && git diff && node -e 'import("./src/cart.js").then(m=>console.log(m.computeTotal([{price:2.5,qty:0},{price:1,qty:0}]), m.computeTotal([{price:2.5,qty:0},{price:1,qty:3}])))' && node --test 2>&1 | grep -E "^(✖|ℹ (pass|fail))|!=="; git commit -qam "Charge shipping [...193 more chars]
e12 [main] REPLY TO USER:
Fixed. A customer who sets every item to quantity 0 is no longer charged 5 for shipping. A cart that still has at least one real item is still charged it.

**What was wrong.** `shippingFor` in `src/shipping.js` charged shipping whenever the cart had any lines at all (`items.length > 0`). Setting a quantity to 0 leaves the line in the list, so the cart still looked non-empty. It now charges shipping only when some line has a quantity above 0. Following Fix Root Causes, I changed that check in `shippingFor` itself instead of stripping zero-quantity lines in `computeTotal`. That way anything else that calls `shippingFor` gets the correct answer too.

**How I checked it.**
- Before the fix, a cart with two lines both at quantity 0 cost `5`. After the fix it costs `0`. A cart with one line at 0 and one at 3 × $1 still costs `8` (3 plus 5 shipping).
- I added a test for the all-zero case. Before the fix it failed with `5 !== 0`, which shows the test catches this bug. It passes now.
- Following Laziness Protocol, the fix is one line and I didn't hand it to a subagent.

There are two commits on `main`: the failing test (`971bb0e`), then the fix (`556d2ac`). I didn't open a PR because the repo has no git remote.

**Separate bug, not fixed.** One existing test, "applies a 10% discount before shipping", was already failing before I changed anything (`-355 !== 41`). The test passes the discount as `10` meaning 10%. The code treats it as a fraction, so it multiplies by `1 - 10`. Only one of those can be right, and the discount is a pricing issue, so I left it alone. It should get its own fix before it reaches a real customer. The full test run is 4 passing and 1 failing, and that one failure is this discount test.
