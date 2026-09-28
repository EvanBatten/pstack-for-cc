=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i readme | head -20)
e3 [main] run: npm test 2>&1 | tail -30; cat README.md
e4 [main] run: sed -i 's/return items.length > 0 ? FLAT_SHIPPING : 0;/return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;/' src/shipping.js && cat >> test/cart.test.js <<'EOF'

test("a cart whose items all have zero quantity costs nothing", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 0 }, { price: 1, qty: 0 }]), 0);
});
EOF
cat src/shipping.js; npm test 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail)) [...1 more chars]
e5 [main] REPLY TO USER:
I fixed the shipping charge. The test suite still has one failure, but it's a separate discount bug that was already failing before my change.

**Cause:** `shippingFor` in `src/shipping.js` only checked whether the cart had any lines (`items.length > 0`). A cart where every quantity was 0 still had lines, so it was charged the flat 5 for shipping.

**Fix:** shipping is now only charged if at least one item has a quantity above 0:
```js
return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;
```
I added a test for a cart where every item has quantity 0; it passes, and the order now totals 0. The existing tests for an empty cart and a normal cart still pass. I haven't committed anything.

**Separate bug, not fixed:** the test "applies a 10% discount before shipping" fails and returns **-355** instead of 41. The test passes `discountPct: 10`, but `computeTotal` treats the value as a fraction: `subtotal * (1 - 10)`. Any caller passing a percentage the way the test does would produce a negative total at checkout. The fix is either to divide by 100 in `computeTotal` or to have callers pass `0.1`, and which one is right depends on how checkout passes the discount today. Want me to look into that next?
