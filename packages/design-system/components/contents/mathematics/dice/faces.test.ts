// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  DIE,
  FACE_FRAMES,
  FACE_UP,
  FACES,
  pipPlacements,
} from "@repo/design-system/components/contents/mathematics/dice/faces";
import {
  rotate,
  type Triple,
} from "@repo/design-system/components/contents/mathematics/dice/turn";
import { Array as Arr } from "effect";

/** The dot product of two vectors. */
function dot(a: Triple, b: Triple) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The cross product of two vectors. */
function cross(a: Triple, b: Triple): Triple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

describe("a standard die", () => {
  it("turns each face to the top", () => {
    Arr.forEach(FACES, (face) => {
      const up = rotate(FACE_UP[face], FACE_FRAMES[face].normal);
      expect(up[0]).toBeCloseTo(0, 12);
      expect(up[1]).toBeCloseTo(1, 12);
      expect(up[2]).toBeCloseTo(0, 12);
    });
  });

  it("puts opposite faces on 7 and runs 1, 2, 3 counterclockwise", () => {
    Arr.forEach(FACES, (face) => {
      const opposite = Arr.getUnsafe(FACES, 6 - face);
      expect(dot(FACE_FRAMES[face].normal, FACE_FRAMES[opposite].normal)).toBe(
        -1
      );
    });
    const handed = dot(
      cross(FACE_FRAMES[1].normal, FACE_FRAMES[2].normal),
      FACE_FRAMES[3].normal
    );
    expect(handed).toBe(1);
  });

  it("lays every face's pips across that face", () => {
    Arr.forEach(FACES, (face) => {
      const { across, down, normal } = FACE_FRAMES[face];
      expect(dot(across, normal)).toBe(0);
      expect(dot(down, normal)).toBe(0);
      expect(dot(across, down)).toBe(0);
    });
  });

  it("drills 21 pips, as many on each face as its number, all inside the face", () => {
    const pips = pipPlacements();
    expect(pips).toHaveLength(21);
    Arr.forEach(FACES, (face) => {
      const own = Arr.filter(
        pips,
        (pip) => pip.normal === FACE_FRAMES[face].normal
      );
      expect(own).toHaveLength(face);
      Arr.forEach(own, (pip) => {
        expect(dot(pip.position, pip.normal)).toBeCloseTo(DIE.half, 12);
        Arr.forEach(pip.position, (coordinate) => {
          expect(Math.abs(coordinate)).toBeLessThanOrEqual(DIE.half + 1e-12);
        });
      });
    });
  });
});
