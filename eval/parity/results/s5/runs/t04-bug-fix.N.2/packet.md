=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i readme | head -20)
e3 [main] run: npm test 2>&1 | tail -30
e4 [main] says (interim): That discount test was already failing before I changed anything. I'll get back to it after the shipping fix.
e5 [main] run: cat > src/shipping.js <<'EOF'
export const FLAT_SHIPPING = 5;

export function shippingFor(items) {
  return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;
}
EOF
cat >> test/cart.test.js <<'EOF'

test("a cart whose items all have zero quantity costs nothing", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 0 }, { price: 1, qty: 0 }]), 0);
});
EOF
npm test 2>&1 | grep -E "^(✔|✖|ℹ ( [...12 more chars]
e6 [main] REPLY TO USER:
I fixed the shipping bug: a cart where every quantity is 0 now totals 0 instead of 5. The shipping function in `src/shipping.js` only checked whether the cart had any rows, so rows with quantity 0 still triggered the 5 fee. It now charges shipping only if at least one item has a quantity above 0.

I added a test for the all-zero-quantity cart, and it passes. The 4 older tests that don't cover discounts also pass.

**Discounts are also broken:** the test "applies a 10% discount before shipping" was already failing before my change, and it still fails. That test passes `discountPct: 10`, but `computeTotal` in `src/cart.js` treats the value as a fraction and multiplies by `1 - 10`. A $40 order therefore comes out at **-$355** instead of $41. If checkout sends whole-number percentages like the test does, discounted orders are charged negative amounts right now.

The fix depends on which format callers send. If they send whole numbers like `10`, divide by 100. If they send fractions like `0.1`, the test is wrong instead. I haven't changed this because it's a separate bug from the one you asked about. Tell me which format checkout uses and I'll fix it.

Also, the `/poteto-mode` command isn't installed in this session, so I handled your message as a plain request.
