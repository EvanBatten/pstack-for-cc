=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] says (interim): I'll look at the checkout code and the bug-fix playbook first.
e3 [main] run: git ls-files; ls "<pstack>/poteto-mode/playbooks" "<pstack>"
e4 [main] read <pstack>/poteto-mode/playbooks/bug-fix.md (full)
e5 [main] read <repo>/src/cart.js (full)
e6 [main] read <repo>/src/shipping.js (full)
e7 [main] read <repo>/src/money.js (full)
e8 [main] read <repo>/test/cart.test.js (full)
e9 [main] read <repo>/package.json (full)
e10 [main] says (interim): Root cause candidate is visible: `shippingFor` checks `items.length`, so zero-quantity lines still count. Reproducing and running the suite now, plus reading the principles I'll apply.
e11 [main] read <pstack>/poteto-mode/principles/fix-root-causes.md (full)
e12 [main] read <pstack>/poteto-mode/principles/laziness-protocol.md (full)
e13 [main] read <pstack>/poteto-mode/principles/sequence-verifiable-units.md (full)
e14 [main] run: npm test 2>&1 | tail -40; node -e "import('./src/cart.js').then(m=>console.log('zero-qty total:', m.computeTotal([{price:2.5,qty:0},{price:1,qty:0}])))"; git log --oneline | head
e15 [main] edit <repo>/test/cart.test.js
e16 [main] run: git remote -v; git checkout -q -b fix/zero-qty-shipping && node --test --test-name-pattern="zero quantity" 2>&1 | grep -E "✔|✖|!==" | head -5; git commit --trailer "Co-authored-by: <agent>" -qam "test: zero-quantity cart should not be charged shipping" && echo committed
e17 [main] says (interim): Now the fix. Shipping should depend on whether anything actually ships, not on how many lines are in the array.
e18 [main] edit <repo>/src/shipping.js
e19 [main] run: npm test 2>&1 | grep -E "^(✔|✖)|^ℹ (pass|fail)|!=="; node -e "import('./src/cart.js').then(m=>console.log('zero-qty total:', m.computeTotal([{price:2.5,qty:0},{price:1,qty:0}]), '| mixed:', m.computeTotal([{price:2.5,qty:0},{price:1,qty:3}])))"; git commit --trailer "Co-authored-by: <agent>" -qam "fix: don't charge shipping when every line has zero quantity" && git log --oneline | head -3
e20 [main] REPLY TO USER:
I fixed it. A cart where every line has quantity 0 now totals 0 instead of charging 5 for shipping.

**What was broken.** `shippingFor` in `src/shipping.js` decided on shipping from `items.length > 0`. Setting a quantity to 0 leaves the line in the array. So a cart with nothing in it still counted as non-empty and got the flat 5 shipping charge.

**Fix.** Shipping now applies only when some line has a quantity above 0:

```1:5:src/shipping.js
export const FLAT_SHIPPING = 5;

export function shippingFor(items) {
  return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;
}
```

Customers who empty their cart by zeroing each quantity now pay nothing. Anyone maintaining this code gets a single rule for "does this order ship," with no change to its callers. I searched the repo and `shippingFor` is the only place that used `items.length` to mean "has items."

**Verification.** Measured on branch `fix/zero-qty-shipping`, in two commits. The first adds the failing test and the second adds the fix. Before the fix, the new test failed:

```
✖ a cart whose lines are all zero quantity costs nothing (2.8057ms)
  5 !== 0
```

After the fix, it passes. I also ran a direct check: the all-zero cart totals `0`, and a cart that mixes a zero line with a real line totals `8`, so shipping still applies there.

```
✔ a cart whose lines are all zero quantity costs nothing (0.1628ms)
zero-qty total: 0 | mixed: 8
```

**A separate bug I left alone.** The test "applies a 10% discount before shipping" was already failing on `main` before my change, and it still fails (`-355 !== 41`). `computeTotal` calculates `subtotal * (1 - discountPct)`, which treats the discount as a fraction, but the test passes `10` to mean 10%. That means a 10% discount currently makes the total negative. I didn't touch it because it's a different bug and it needs a decision about the API: should `discountPct` be `10` or `0.1`? I can fix it next if you want.

**Principles that shaped this.**
- **Fix Root Causes.** I reproduced the 5 charge first. Then I fixed the rule that decides whether an order ships, rather than special-casing zero totals in `computeTotal`.
- **Laziness Protocol.** The fix is one line in the function that owns the decision. I didn't add a cleanup step to strip zero-quantity lines, because nothing needed it.
- **Sequence Verifiable Units.** The failing test is committed before the fix, so the history shows the test going from failing to passing.

There's no git remote, so I didn't open a PR. The branch is local and ready to push.
