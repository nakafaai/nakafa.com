import { describe, expect, it } from "@effect/vitest";
import { standsOn } from "@repo/design-system/components/three/stage/place";

describe("standsOn", () => {
  it("keeps the ground a lab names", () => {
    expect(standsOn("lab", 0, "oak")).toBe("oak");
    expect(standsOn("space", 0, "sand")).toBe("sand");
  });

  it("gives a lab with a floor the ground of its place", () => {
    expect(standsOn("lab", 0, undefined)).toBe("epoxy");
    expect(standsOn("dark", 0.2, undefined)).toBe("epoxy");
    expect(standsOn("field", 0, undefined)).toBe("grass");
    expect(standsOn("studio", -1, undefined)).toBe("maple");
  });

  it("leaves a place with nothing to stand on without a ground", () => {
    expect(standsOn("space", 0, undefined)).toBeUndefined();
    expect(standsOn("water", 0, undefined)).toBeUndefined();
    expect(standsOn("sky", 0, undefined)).toBeUndefined();
  });

  it("gives a lab without a floor no ground, whatever it names", () => {
    expect(standsOn("lab", undefined, undefined)).toBeUndefined();
    expect(standsOn("field", undefined, "grass")).toBeUndefined();
  });
});
