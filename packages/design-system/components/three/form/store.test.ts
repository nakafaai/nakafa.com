import { describe, expect, it } from "@effect/vitest";
import { claim, hold } from "@repo/design-system/components/three/form/store";
import { turnShape } from "@repo/design-system/components/three/form/turn";

/** Builds a small surface, and counts how often it is asked to. */
function builder() {
  return vi.fn(() =>
    turnShape(
      {
        profile: [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
      },
      0.01
    )
  );
}

describe("claim", () => {
  it("builds a geometry once and shares it with every later claim", () => {
    const build = builder();
    const first = claim("store-shared", build);
    const second = claim("store-shared", build);
    expect(second).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
    expect(first.getAttribute("position").count).toBeGreaterThan(8);
    expect(first.getAttribute("normal").count).toBe(
      first.getAttribute("position").count
    );
    expect(first.getAttribute("uv").itemSize).toBe(2);
    expect(first.getIndex()?.count).toBeGreaterThan(0);
    expect(first.boundingSphere?.radius).toBeGreaterThan(0.9);
    expect(first.boundingBox?.max.y).toBeCloseTo(1, 6);
  });
});

describe("hold", () => {
  it("frees the geometry only when its last holder lets go", () => {
    const build = builder();
    const geometry = claim("store-held", build);
    const freed = vi.fn();
    geometry.addEventListener("dispose", freed);
    const first = hold("store-held", geometry);
    const second = hold("store-held", geometry);
    first();
    expect(freed).not.toHaveBeenCalled();
    expect(claim("store-held", build)).toBe(geometry);
    second();
    expect(freed).toHaveBeenCalledTimes(1);
    expect(claim("store-held", build)).not.toBe(geometry);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("keeps a geometry a part still shows when its last holder left first", () => {
    const build = builder();
    const geometry = claim("store-moved", build);
    hold("store-moved", geometry)();
    const freed = vi.fn();
    geometry.addEventListener("dispose", freed);
    const release = hold("store-moved", geometry);
    expect(claim("store-moved", build)).toBe(geometry);
    expect(build).toHaveBeenCalledTimes(1);
    release();
    expect(freed).toHaveBeenCalledTimes(1);
  });
});
