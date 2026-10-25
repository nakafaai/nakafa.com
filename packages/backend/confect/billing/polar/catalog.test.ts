import { describe, expect, it } from "@effect/vitest";
import {
  proProductIdFor,
  proProductIds,
} from "@repo/backend/confect/billing/polar/catalog";

describe("billing/polar/catalog", () => {
  it("names the Pro product of each Polar server", () => {
    expect(proProductIdFor("production")).toBe(proProductIds.production);
    expect(proProductIdFor("sandbox")).toBe(proProductIds.sandbox);
  });
});
