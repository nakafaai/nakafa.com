import { describe, expect, it } from "@effect/vitest";
import type { Form } from "@repo/design-system/components/three/organism/form";
import {
  attachForm,
  fuseForms,
  smoothNormals,
  unitNormals,
  weldNormals,
} from "@repo/design-system/components/three/organism/form";

/** One triangle lying flat on the ground, facing up. */
const FLAT: Form = {
  color: Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  index: Uint32Array.from([0, 2, 1]),
  normal: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]),
  position: Float32Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]),
  uv: Float32Array.from([0, 0, 1, 0, 0, 1]),
};

describe("smoothNormals", () => {
  it("faces every vertex the way its triangle does, weighted by its area", () => {
    const normal = smoothNormals(FLAT.position, FLAT.index);

    expect(Array.from(normal)).toEqual([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  });
});

describe("weldNormals", () => {
  it("gives the vertices of one place the sum of their normals", () => {
    const normal = Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 5]);

    weldNormals(normal, [[0, 1]]);

    expect(Array.from(normal)).toEqual([1, 1, 0, 1, 1, 0, 0, 0, 5]);
  });
});

describe("unitNormals", () => {
  it("scales a normal to length one and faces an unused vertex up", () => {
    const normal = Float32Array.from([0, 0, 4, 0, 0, 0]);

    unitNormals(normal);

    expect(Array.from(normal)).toEqual([0, 0, 1, 0, 1, 0]);
  });
});

describe("attachForm", () => {
  it("moves a part to its station and turns its length along the span", () => {
    const fin = attachForm(FLAT, [1, 2, 3], [0, 2, 0], [1, 1, 0]);

    expect(fin.position[0]).toBeCloseTo(1);
    expect(fin.position[1]).toBeCloseTo(2);
    expect(fin.position[2]).toBeCloseTo(3);
    expect(fin.position[3]).toBeCloseTo(1);
    expect(fin.position[4]).toBeCloseTo(3);
    expect(fin.position[5]).toBeCloseTo(3);
    expect(fin.normal[0]).toBeCloseTo(1);
    expect(fin.normal[1]).toBeCloseTo(0);
    expect(fin.index).toBe(FLAT.index);
    expect(FLAT.position[0]).toBe(0);
  });
});

describe("fuseForms", () => {
  it("joins parts into one geometry and renumbers the later parts", () => {
    const raised = attachForm(FLAT, [0, 5, 0], [1, 0, 0], [0, 1, 0]);
    const geometry = fuseForms([FLAT, raised]);

    expect(geometry.getAttribute("position").count).toBe(6);
    expect(geometry.getAttribute("uv").count).toBe(6);
    expect(geometry.getAttribute("color").getX(3)).toBe(1);
    expect(Array.from(geometry.getIndex()?.array ?? [])).toEqual([
      0, 2, 1, 3, 5, 4,
    ]);
    expect(geometry.getAttribute("position").getY(3)).toBeCloseTo(5);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(2);
  });
});
