=== turn t0 ===
e1 [main] USER: /poteto-mode A customer removed every item from their order by setting each quantity to 0, and checkout still charged them 5 for shipping. Fix it.
e2 [main] says (interim): I'll look at the checkout/shipping logic to find where empty orders still get a shipping fee.
e3 [main] run: git ls-files | head -50 && rg -n -i "shipping|quantity" --glob '!node_modules' -g '!*.lock' .
e4 [main] read <repo>/src/cart.js (full)
e5 [main] read <repo>/test/cart.test.js (full)
e6 [main] read <repo>/package.json (full)
e7 [main] says (interim): The bug is in `shippingFor`: it checks `items.length > 0`, so zero-quantity lines still count as items. Let me run the tests before changing anything.
e8 [main] run: npm test 2>&1 | tail -30
e9 [main] says (interim): A discount test was already failing before I changed anything (unrelated, details below). Now the shipping fix and a regression test:
e10 [main] edit <repo>/src/shipping.js
e11 [main] edit <repo>/test/cart.test.js
e12 [main] run: npm test 2>&1 | grep -E "^(✔|✖|ℹ (pass|fail))"
e13 [main] REPLY TO USER:
An order where every quantity is 0 now costs 0, with no shipping charge. The problem was in `src/shipping.js`: shipping was charged whenever the order had any line items, even if every line had quantity 0. It now charges shipping only if at least one item has a quantity above 0:

```3:5:src/shipping.js
export function shippingFor(items) {
  return items.some((item) => item.qty > 0) ? FLAT_SHIPPING : 0;
}
```

I added a test for your customer's case, an order where every quantity is 0, and it passes.

One test still fails, but it was already failing before my change: "applies a 10% discount before shipping". `computeTotal` treats `discountPct` as a fraction (`1 - discountPct`), but the test passes `10`. That makes the discount a factor of −9, so the total comes out as −355 instead of 41. I left it alone because it's a different bug, and the right fix depends on what callers pass. If they pass whole percentages like `10`, the code should divide by 100. If they pass fractions like `0.1`, the test is wrong. I can fix whichever it is once you tell me what callers use.
