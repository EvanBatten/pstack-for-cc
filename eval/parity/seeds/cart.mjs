const pkg = `{
  "name": "shop-cart",
  "version": "0.3.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
`;

const money = `export const roundCents = (amount) => Math.round(amount * 100) / 100;
`;

const cartV1 = `import { roundCents } from "./money.js";

export function lineTotal(item) {
  return item.price * item.qty;
}

export function computeTotal(items) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  return roundCents(subtotal);
}
`;

const cartV2 = `import { roundCents } from "./money.js";

export function lineTotal(item) {
  return roundCents(item.price * item.qty);
}

export function computeTotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}
`;

const cartV3 = `import { roundCents } from "./money.js";
import { shippingFor } from "./shipping.js";

export function lineTotal(item) {
  return roundCents(item.price * item.qty);
}

export function computeTotal(items, { discountPct = 0 } = {}) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0);
  const discounted = subtotal * (1 - discountPct);
  return roundCents(discounted + shippingFor(items));
}
`;

const shipping = `export const FLAT_SHIPPING = 5;

export function shippingFor(items) {
  return items.length > 0 ? FLAT_SHIPPING : 0;
}
`;

const testV1 = `import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotal } from "../src/cart.js";

test("sums line items", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 2 }, { price: 1, qty: 3 }]), 8);
});
`;

const testV2 = `import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotal, lineTotal } from "../src/cart.js";

test("sums line items", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 2 }, { price: 1, qty: 3 }]), 8);
});

test("rounds each line to cents", () => {
  assert.equal(lineTotal({ price: 0.333, qty: 3 }), 1);
});
`;

const testV3 = `import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotal, lineTotal } from "../src/cart.js";

test("sums line items plus flat shipping", () => {
  assert.equal(computeTotal([{ price: 2.5, qty: 2 }, { price: 1, qty: 3 }]), 13);
});

test("rounds each line to cents", () => {
  assert.equal(lineTotal({ price: 0.333, qty: 3 }), 1);
});

test("applies a 10% discount before shipping", () => {
  assert.equal(computeTotal([{ price: 20, qty: 2 }], { discountPct: 10 }), 41);
});

test("an empty cart costs nothing", () => {
  assert.equal(computeTotal([]), 0);
});
`;

const readme = `# shop-cart

Cart pricing for the shop checkout. \`npm test\` runs the suite.

- \`src/cart.js\` computes line totals and the cart total.
- \`src/money.js\` rounds to cents.
- \`src/shipping.js\` charges flat shipping.
`;

/** @type {{ message: string, files: Record<string, string> }[]} */
export const CART_COMMITS = [
  {
    message: "start the cart pricing module",
    files: { "package.json": pkg, "README.md": readme, "src/money.js": money, "src/cart.js": cartV1, "test/cart.test.js": testV1 },
  },
  {
    message:
      "round each line to cents before summing\n\nFinance reconciles invoices line by line against the ledger export. Rounding\nonly the cart total left one-cent mismatches on about 2% of invoices (FIN-212),\nso every line is rounded first and the total is the sum of rounded lines.",
    files: { "src/cart.js": cartV2, "test/cart.test.js": testV2 },
  },
  {
    message: "add flat shipping and percentage discounts",
    files: { "src/cart.js": cartV3, "src/shipping.js": shipping, "test/cart.test.js": testV3 },
  },
];
