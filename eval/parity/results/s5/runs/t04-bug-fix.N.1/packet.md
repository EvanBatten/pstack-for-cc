=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] run: git ls-files && cat $(git ls-files | grep -v -i readme | head -20)
e3 [main] run: npm test 2>&1 | tail -30
e4 [main] run: cat > src/shipping.js <<'EOF'
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
npm test 2>&1 | grep -E "^(✔|✖)"
e5 [main] REPLY TO USER:
An order where every quantity is 0 now costs 0 at checkout. It used to charge 5 for shipping.

**Cause:** `src/shipping.js` added the flat shipping charge whenever the cart had any items at all (`items.length > 0`). Items set to quantity 0 stayed in the list, so a cart with nothing in it still paid shipping.

**Fix:** shipping is now charged only if at least one item has a quantity above 0 (`items.some((item) => item.qty > 0)`). I added a test in `test/cart.test.js` for a cart where every quantity is 0. With the old code it would have come out at 5; it now expects 0 and passes. I haven't committed anything.

**A separate bug the test run turned up:** the test `applies a 10% discount before shipping` fails, and it was failing before my change. The code treats `discountPct` as a fraction (0.1 for 10%), but the test passes `10`. The result is a total of **-355** instead of 41. If any real caller passes whole-number percentages like `10`, customers get negative totals.

I didn't change it because the fix depends on which format callers are meant to use. One option is to treat `discountPct` as a whole-number percent and divide by 100, which matches its name and the test. The other is to keep it as a fraction and fix the test. I'd go with dividing by 100, but I wanted to check with you first.
