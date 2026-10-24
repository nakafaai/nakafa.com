import { describe, expect, it } from "@effect/vitest";
import {
  proProductIdFor,
  proProductIds,
} from "@repo/backend/confect/billing/polar/catalog";

describe("billing/polar/catalog", () => {
  it("maps the production server to the production Pro product", () => {
    expect(proProductIdFor("production")).toBe(proProductIds.production);
  });

  it("maps a sandbox, missing or unknown server to the sandbox Pro product", () => {
    expect(proProductIdFor("sandbox")).toBe(proProductIds.sandbox);
    expect(proProductIdFor(undefined)).toBe(proProductIds.sandbox);
    expect(proProductIdFor("unknown-server")).toBe(proProductIds.sandbox);
  });
});
