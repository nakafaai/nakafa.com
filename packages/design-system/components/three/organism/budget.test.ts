import { describe, expect, it } from "@effect/vitest";
import {
  bodyDetail,
  faces,
} from "@repo/design-system/components/three/organism/budget";

describe("bodyDetail", () => {
  it("draws every face on a desktop GPU and fewer on each lower tier", () => {
    expect(bodyDetail("full")).toBe(1);
    expect(bodyDetail("light")).toBe(0.8);
    expect(bodyDetail("low")).toBe(0.6);
    expect(bodyDetail("plain")).toBe(0.5);
  });
});

describe("faces", () => {
  it("keeps an even share of the full count, never fewer than eight", () => {
    expect(faces(96, 1)).toBe(96);
    expect(faces(90, 0.5)).toBe(46);
    expect(faces(10, 0.5)).toBe(8);
  });
});
