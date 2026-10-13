import { test, expect } from "vitest";

import { money } from "./money";

test.each([
  [2500000, "2,500,000.00"],
  [5239.73, "5,239.73"],
  [1500, "1,500.00"],
  [0, "0.00"],
  [14239.73, "14,239.73"],
])("money(%s) = %s", (input, expected) => {
  expect(money(input)).toBe(expected);
});
