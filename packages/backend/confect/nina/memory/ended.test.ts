import { describe, expect, it } from "@effect/vitest";
import { hasEnded } from "@repo/backend/confect/nina/memory/ended";

describe("hasEnded", () => {
  it("ends a memory whose end date is before the moment, and not one that ends at it or after", () => {
    expect(hasEnded({ validUntil: 999 }, 1000)).toBe(true);
    expect(hasEnded({ validUntil: 1000 }, 1000)).toBe(false);
    expect(hasEnded({ validUntil: 1001 }, 1000)).toBe(false);
  });

  it("never ends a memory that has no end date", () => {
    expect(hasEnded({}, 1000)).toBe(false);
  });
});
