=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] says (interim): I'll look at how checkout computes shipping for the cart.
e3 [main] run: git ls-files | head -50; rg -n -i "shipping" --glob '!node_modules'
e4 [main] read <repo>/src/cart.js (full)
e5 [main] read <repo>/test/cart.test.js (full)
e6 [main] read <repo>/package.json (full)
e7 [main] says (interim): The bug: `shippingFor` checks `items.length > 0`, so a cart of zero-quantity lines still counts as non-empty. Let me run the tests before changing anything.
e8 [main] run: npm test 2>&1 | tail -30
e9 [main] says (interim): One test was already failing before I changed anything. It's a separate discount bug, which I'll come back to. Now the shipping fix: charge shipping only when some line has a positive quantity.
e10 [main] read <repo>/src/shipping.js (full)
e11 [main] edit <repo>/src/shipping.js
e12 [main] edit <repo>/test/cart.test.js
e13 [main] run: git stash -q -- src/shipping.js && npm test 2>&1 | grep -E "^(✔|✖)"; git stash pop -q && npm test 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail))"
e14 [main] REPLY TO USER:
I fixed it: an order where every quantity is 0 now totals 0, with no shipping charge.

**Cause:** `shippingFor` in `src/shipping.js` checked `items.length > 0`. Setting quantities to 0 leaves the lines in the cart, so the cart looked non-empty and got the flat 5 shipping. It now charges shipping only if at least one line has a quantity above 0:

```1:5:src/shipping.js
export const FLAT_SHIPPING = 5;

export function shippingFor(items) {
  return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;
}
```

I added two tests in `test/cart.test.js`. One checks that an all-zero cart costs 0. The other checks that a cart mixing zero and non-zero lines still pays shipping once. The all-zero test fails without the fix and passes with it.

**Separate bug, not fixed:** the test "applies a 10% discount before shipping" was already failing before my change. `computeTotal` treats `discountPct` as a fraction (`1 - discountPct`), but the test passes `10`. So a 10% discount gives a total of **-355** instead of 41, which would charge a customer a negative amount. The fix is either dividing by 100 in `computeTotal` or passing `0.1` from callers, depending on which convention the code that calls it uses. I left it alone because it's outside this fix, but it's worth fixing soon. I can do it if you want.
