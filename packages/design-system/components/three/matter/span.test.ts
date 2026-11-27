import { describe, expect, it } from "@effect/vitest";
import { spanOf } from "@repo/design-system/components/three/matter/span";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  PlaneGeometry,
  Shape,
} from "three";

const flat = { across: 1, along: 1, upright: false };

describe("spanOf", () => {
  it("answers a board's width and depth", () => {
    const { across, along } = spanOf(new PlaneGeometry(3, 2));

    expect(across).toBeCloseTo(3);
    expect(along).toBeCloseTo(2);
  });

  it("answers the girth and the height of an open cylinder", () => {
    const { across, along } = spanOf(
      new CylinderGeometry(0.5, 0.5, 4, 96, 1, true)
    );

    expect(across).toBeCloseTo(Math.PI, 1);
    expect(along).toBeCloseTo(4);
  });

  it("finds a post upright and a board and a cube not", () => {
    expect(spanOf(new BoxGeometry(0.1, 2, 0.1)).upright).toBe(true);
    expect(spanOf(new BoxGeometry(0.1, 0.1, 2)).upright).toBe(false);
    expect(spanOf(new CylinderGeometry(0.02, 0.02, 1, 24)).upright).toBe(true);
    expect(spanOf(new BoxGeometry(3, 0.1, 2)).upright).toBe(false);
    expect(spanOf(new BoxGeometry(1, 1, 1)).upright).toBe(false);
  });

  it("finds an extruded post upright where most of its faces run up it", () => {
    const section = new Shape()
      .moveTo(0, 0)
      .lineTo(0.3, 0)
      .lineTo(0.3, 2)
      .lineTo(0, 2)
      .closePath();
    const post = new ExtrudeGeometry(section, {
      bevelEnabled: false,
      depth: 0.1,
    });
    const rail = new ExtrudeGeometry(section, {
      bevelEnabled: false,
      depth: 0.1,
    }).rotateZ(Math.PI / 2);

    expect(spanOf(post).upright).toBe(true);
    expect(spanOf(rail).upright).toBe(true);
  });

  it("reads a part drawn without shared corners the same way", () => {
    const { across, along } = spanOf(new PlaneGeometry(3, 2).toNonIndexed());

    expect(across).toBeCloseTo(3);
    expect(along).toBeCloseTo(2);
  });

  it("answers one unit each way for a part with no texture coordinates", () => {
    const bare = new BufferGeometry();
    bare.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3)
    );

    expect(spanOf(bare)).toStrictEqual(flat);
    expect(spanOf(new BufferGeometry())).toStrictEqual(flat);
  });

  it("passes over a triangle that is a line on the part or in its texture", () => {
    const folded = new BufferGeometry();
    folded.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([
          0, 0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0,
        ]),
        3
      )
    );
    folded.setAttribute(
      "uv",
      new BufferAttribute(
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 2, 0]),
        2
      )
    );

    expect(spanOf(folded)).toStrictEqual(flat);
  });
});
