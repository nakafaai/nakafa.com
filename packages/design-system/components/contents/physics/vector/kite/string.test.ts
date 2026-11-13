import { describe, expect, it } from "@effect/vitest";
import {
  LineSchema,
  lineParts,
} from "@repo/design-system/components/contents/physics/vector/kite/string";
import { Schema } from "effect";

const line = Schema.decodeUnknownSync(LineSchema)({ length: 30, tension: 40 });

describe("lineParts", () => {
  it("takes the cosine for the vertical part when the angle is from the vertical", () => {
    const parts = lineParts(line, 60);
    expect(parts.up).toBeCloseTo(20, 10);
    expect(parts.across).toBeCloseTo(34.641, 3);
    expect(parts.height).toBeCloseTo(15, 10);
    expect(parts.downwind).toBeCloseTo(25.98, 2);
  });

  it("pulls straight up with no horizontal part when the string is vertical", () => {
    const parts = lineParts(line, 0);
    expect(parts.up).toBe(40);
    expect(parts.across).toBe(0);
  });
});
