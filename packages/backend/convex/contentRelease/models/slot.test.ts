import { expect, it } from "@effect/vitest";
import { alternateModelSlot } from "@repo/backend/convex/contentRelease/models/slot";

it("selects the opposite bounded read-model buffer", () => {
  expect(alternateModelSlot("blue")).toBe("green");
  expect(alternateModelSlot("green")).toBe("blue");
});
