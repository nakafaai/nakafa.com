// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { Swimmer, schoolOf, swimmerFaces } from "@/lib/island/models/ocean";
import { boundsOf, meters, normalOf } from "@/lib/island/models/parts";

/** Each swimmer's real length in meters, as a field guide gives it. */
const LENGTHS = {
  dolphin: 2.8,
  hammerhead: 4,
  orca: 7,
  "reef-shark": 1.8,
  "tiger-shark": 4,
  "whale-shark": 10,
} satisfies Record<Swimmer, number>;

describe("island/models/ocean", () => {
  it("builds every big swimmer at its real length, centered on its path, every face sound", () => {
    for (const kind of Swimmer.literals) {
      const faces = swimmerFaces(kind);
      const bounds = boundsOf(faces);
      expect(
        Math.abs(bounds.z[1] - bounds.z[0] - meters(LENGTHS[kind])) /
          meters(LENGTHS[kind])
      ).toBeLessThan(0.03);
      expect(Math.abs(bounds.z[1] + bounds.z[0])).toBeLessThan(
        meters(LENGTHS[kind]) * 0.05
      );
      expect(
        Arr.every(faces, (face) => Math.hypot(...normalOf(face.corners)) > 0.5)
      ).toBe(true);
    }
    expect(boundsOf(swimmerFaces("hammerhead")).x[1]).toBeGreaterThan(
      boundsOf(swimmerFaces("tiger-shark")).x[1] * 0.9
    );
  });

  it("spreads a school so no two fish ever touch, the same way on every island with its seed", () => {
    const school = schoolOf(24, 0.5, 11);
    expect(school).toHaveLength(24);
    const gaps = Arr.flatMap(school, (fish, index) =>
      Arr.map(Arr.drop(school, index + 1), (other) =>
        Math.hypot(
          fish.at[0] - other.at[0],
          fish.at[1] - other.at[1],
          fish.at[2] - other.at[2]
        )
      )
    );
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.5);
    expect(schoolOf(24, 0.5, 11)).toEqual(school);
    expect(schoolOf(24, 0.5, 12)).not.toEqual(school);
    expect(Arr.every(school, (fish) => fish.lag >= 0 && fish.lag < 1)).toBe(
      true
    );
  });
});
