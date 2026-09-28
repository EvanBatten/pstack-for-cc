=== turn t0 ===
e1 [main] USER: /poteto-mode Add coupon codes to the cart. SAVE10 takes 10% off the subtotal, FLAT5 takes 5 off, one code per order, and an unknown code is rejected with a clear error. Cover it with tests.
e2 [main] says (interim): I'll look at the cart code and existing tests first.
e3 [main] run: git ls-files; cat package.json 2>/dev/null
e4 [main] read <repo>/src/cart.js (full)
e5 [main] read <repo>/src/money.js (full)
e6 [main] read <repo>/src/shipping.js (full)
e7 [main] read <repo>/test/cart.test.js (full)
e8 [main] read <repo>/README.md (full)
e9 [main] run: npm test 2>&1 | tail -30
e10 [main] edit <repo>/src/coupons.js
e11 [main] edit <repo>/src/cart.js
e12 [main] says (interim): Now the tests.
e13 [main] edit <repo>/README.md
e14 [main] edit <repo>/test/coupons.test.js
e15 [main] run: npm test 2>&1 | tail -30
e16 [main] REPLY TO USER:
Coupon codes are now supported in the cart. All 13 tests pass: the 4 existing ones plus 9 new coupon tests.

**How it works:** `computeTotal(items, { coupon: "SAVE10" })` applies the code to the subtotal before shipping is added. The code is in a new `src/coupons.js`.
- **`SAVE10`** takes 10% off the subtotal. A $40 cart with $5 shipping comes to $41.
- **`FLAT5`** takes 5 off the subtotal. It never takes the subtotal below zero, so a $3 cart comes to $5 (shipping only).
- **An unknown or empty code** throws a `CouponError` with the message `Unknown coupon code "BOGUS".`
- **One code per order:** `coupon` takes a single string. Passing an array throws `CouponError: Only one coupon code can be applied per order.`
- Codes are matched without regard to case or surrounding spaces, so `" save10 "` works. I chose this myself; tell me if you'd rather require exact matches.

**Existing bug I fixed:** one of the four existing tests was already failing before I changed anything. `discountPct` is named and tested as a percentage, but the code subtracted it as a fraction, so passing `10` gave a total of -355 instead of 41. It now divides by 100. That changes behaviour for any caller that was passing fractions like `0.1`. There are none in this repo.

**Decision for you:** you didn't say how a coupon should combine with an existing `discountPct`. Right now the percentage discount is applied first and the coupon second, so both reduce the total.

I also added a line about `src/coupons.js` to the README. `/poteto-mode` isn't a mode or skill I have, so I handled this as a normal request.

=== turn t1 ===
e17 [main] USER: FLAT5 is losing us money on small orders. Only accept it when the subtotal is at least 20. Below that, reject it with an error that tells the customer the amount they still need to add.
e18 [main] says (interim): I'll add a minimum-subtotal rule to FLAT5. The threshold will be checked against the item subtotal before any `discountPct`, because adding items is the only way the customer can reach it.
e19 [main] edit <repo>/src/coupons.js
e20 [main] edit <repo>/src/cart.js
e21 [main] edit <repo>/test/coupons.test.js
e22 [main] edit <repo>/README.md
e23 [main] run: npm test 2>&1 | tail -30
e24 [main] REPLY TO USER:
FLAT5 now only works when the subtotal is at least 20. All 18 tests pass.

Below 20, the customer gets a `CouponError` that says how much more to add, for example: `FLAT5 requires a subtotal of at least 20.00. Add 7.50 more to use it.` A subtotal of exactly 20 is accepted.

- **What counts as the subtotal:** the minimum is checked against the item subtotal before any `discountPct`. Adding items is the only way a customer can reach the threshold, so that's the amount the message should be based on. For example, a $20 cart with a 10% discount still qualifies. If you'd rather check the amount after the discount, it's a one-line change in `src/cart.js`.
- **Rounding:** the shortfall is rounded to whole cents, so a $19.99 cart says "Add 0.01 more" rather than showing floating-point noise.
- **Where the rule lives:** each coupon in `COUPONS` in `src/coupons.js` now has a `minSubtotal` field. SAVE10's is 0, and it's covered by a test.
- **Tests:** I replaced the old "never below zero" test, since its $3 cart is now rejected. That floor can still be hit when a 90% discount and FLAT5 are combined, so the test covers that case instead. I added five more tests for the new rule, and updated the README line about coupons.

=== turn t2 ===
e25 [main] USER: Review the coupon work as if a teammate had sent it to you. What would you block on before it merges?
e26 [main] says (interim): I'll reread the current code before judging it.
e27 [main] run: git status --short; git diff; cat src/coupons.js src/cart.js
e28 [main] says (interim): Next I'll check two suspected bugs directly: floating-point sums at the 20 boundary, and what happens with `null` or empty-string coupons.
e29 [main] run: node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
const tryIt = (label, items, opts) => { try { console.log(label, computeTotal(items, opts)); } catch (e) { console.log(label, "THROWS:", e.message); } };
tryIt("19.9 + 0.1 FLAT5:", [{price:19.9,qty:1},{price:0.1,qty:1}], {coupon:"FLAT5"});
tryIt("10.1 + 9.9 FLAT5:", [{price:10.1,qty:1},{price:9.9,qty:1}], {coupon:"FLAT5"}) [...783 more chars]
e30 [main] run: node --input-type=module -e '
import { computeTotal } from "./src/cart.js";
try { computeTotal([{price:6.1,qty:1},{price:9.95,qty:1},{price:3.95,qty:1}], {coupon:"FLAT5"}); } catch (e) { console.log(e.message); }'
e31 [main] REPLY TO USER:
I'd block this change on four things. The worst is a confirmed bug: an order that adds up to exactly 20.00 can be refused FLAT5 with the message "Add 0.00 more". I wrote this code, but I've reviewed it as if a teammate sent it.

## Blocking

**1. Floating-point sums reject valid FLAT5 orders.** In `computeTotal`, each line is rounded to cents, but the sum of the lines isn't. So three items priced 6.10, 9.95 and 3.95 add up to `19.999999999999996`, not 20. I ran it, and the customer gets:

`FLAT5 requires a subtotal of at least 20.00. Add 0.00 more to use it.`

The fix is to wrap the `reduce` in `roundCents(...)`, or better, do all the arithmetic in whole cents. The boundary test only uses a single $20 item, which is why it didn't catch this. It needs a test that sums several items to exactly 20.

**2. The `discountPct` change silently breaks other callers.** Changing it from a fraction to a percentage fixed a failing test, but this is a pricing package at 0.3.0 and may have callers outside this repo. Nothing fails for a caller still passing `0.1`: a $100 cart that used to come to $95 now comes to $104.90, because the discount dropped from 10% to 0.1%. That fix should go in its own PR, with a version bump, and ideally code that rejects `discountPct` outside 0 to 100 so wrong input fails loudly.

**3. `discountPct` and a coupon stack with no one having decided they should.** Last time I flagged this as an open question, but it ended up in the tests as expected behaviour. It also works against why the FLAT5 minimum exists: a $20 cart with a 90% discount plus FLAT5 comes to $0 of goods plus $5 shipping. Someone on the product side has to decide whether they combine before this merges. If they do, the minimum probably needs to be checked after the discount, or combined orders need a separate floor.

**4. `null` gives the wrong error, and an empty string is rejected.** `coupon: null` throws "Only one coupon code can be applied per order.", which is untrue. `coupon: ""` throws `Unknown coupon code ""`. Both are what an empty form field or a JSON body usually sends. They should mean "no coupon", and the "one code" error should only fire when an array is actually passed. Neither case has a test.

## Should fix, not blocking

- **Errors only work as text.** `CouponError` carries nothing but English wording, so a checkout page can't translate it, format the currency, or show "add $7.50" next to the cart. It should have a `code` field (for example `UNKNOWN_COUPON` or `BELOW_MINIMUM`) and the numbers (`minSubtotal`, `shortfall`) as properties.
- **Raw customer input goes back into the error message.** Wherever the message is displayed, it needs escaping, and very long input should be cut short.
- **Coupon lookup is safe only by accident.** `COUPONS[normalized]` doesn't return built-in object properties only because the code is uppercased first. It should use `Object.hasOwn`, and `COUPONS` should be frozen, since any importer can currently change the prices.
- **Money is still floating point.** Issue 1 is one symptom. `roundCents` also has the usual `1.005` rounding problem, which was already there before this work. Storing amounts as whole cents would fix both.

## Fine as is

Putting the coupon rules in one table with `minSubtotal` works well. Checking the minimum against the item subtotal fits a message about what the customer needs to add. The happy-path and error tests are clear.

Issues 1 and 4 are small fixes I can make now. Issues 2 and 3 need your call: splitting the `discountPct` fix into its own PR, and deciding whether a discount and a coupon can combine.
