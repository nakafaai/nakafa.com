import { describe, expect, it } from "@effect/vitest";
import { createFramePace } from "@repo/design-system/lib/pace";

describe("createFramePace", () => {
  it("draws every frame while a drawing is cheap", () => {
    const pace = createFramePace();

    expect(pace.isDue(0)).toBe(true);
    pace.rest(0, 2);
    expect(pace.isDue(16)).toBe(true);
  });

  it("rests seven times as long as a costly drawing took", () => {
    const pace = createFramePace();

    pace.rest(100, 120);
    expect(pace.isDue(259)).toBe(false);
    expect(pace.isDue(260)).toBe(true);
  });
});
