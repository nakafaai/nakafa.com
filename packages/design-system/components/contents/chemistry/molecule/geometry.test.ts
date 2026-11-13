import { describe, expect, it } from "@effect/vitest";
import {
  buildMolecule,
  centroid,
  measureAngle,
  PlacementReferenceError,
} from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Result } from "effect";

describe("molecule geometry", () => {
  it("fails a placement that names an atom placed after it", () => {
    const built = buildMolecule([
      { element: "O" },
      { bond: { length: 100, to: 2 }, element: "H" },
    ]);

    expect(Result.isFailure(built) && built.failure).toEqual(
      new PlacementReferenceError({ atom: 1, reference: 2 })
    );
  });

  it("fails a placement that names a negative atom", () => {
    const built = buildMolecule([
      { element: "O" },
      { bond: { length: 100, to: 0 }, element: "H" },
      {
        angle: { degrees: 90, to: -1 },
        bond: { length: 100, to: 0 },
        element: "H",
      },
    ]);

    expect(Result.isFailure(built) && built.failure._tag).toBe(
      "PlacementReferenceError"
    );
  });

  it("twists a fourth atom out of the plane when the first three lie in a line", () => {
    const built = Result.getOrThrow(
      buildMolecule([
        { element: "C" },
        { bond: { length: 100, to: 0 }, element: "C" },
        {
          angle: { degrees: 180, to: 0 },
          bond: { length: 100, to: 1 },
          element: "C",
        },
        {
          angle: { degrees: 90, to: 1 },
          bond: { length: 100, to: 2 },
          dihedral: { degrees: 0, to: 0 },
          element: "H",
        },
      ])
    );
    const [first, second, third, fourth] = built.positions;

    expect(measureAngle(first ?? [0, 0, 0], second ?? [0, 0, 0], third ?? [0, 0, 0])).toBeCloseTo(180, 9);
    expect(measureAngle(second ?? [0, 0, 0], third ?? [0, 0, 0], fourth ?? [0, 0, 0])).toBeCloseTo(90, 9);
  });

  it("twists an atom off a straight chain that runs across the first bond", () => {
    const built = Result.getOrThrow(
      buildMolecule([
        { element: "C" },
        { bond: { length: 100, to: 0 }, element: "C" },
        {
          angle: { degrees: 90, to: 0 },
          bond: { length: 100, to: 1 },
          element: "C",
        },
        {
          angle: { degrees: 180, to: 1 },
          bond: { length: 100, to: 2 },
          element: "C",
        },
        {
          angle: { degrees: 90, to: 2 },
          bond: { length: 100, to: 3 },
          dihedral: { degrees: 0, to: 1 },
          element: "H",
        },
      ])
    );
    const [, , third, fourth, fifth] = built.positions;

    expect(
      measureAngle(third ?? [0, 0, 0], fourth ?? [0, 0, 0], fifth ?? [0, 0, 0])
    ).toBeCloseTo(90, 9);
  });

  it("centres a molecule and treats no atoms as standing at the origin", () => {
    expect(centroid([])).toEqual([0, 0, 0]);
    expect(
      centroid(
        Result.getOrThrow(
          buildMolecule([
            { element: "H" },
            { bond: { length: 200, to: 0 }, element: "H" },
          ])
        ).positions
      )
    ).toEqual([0, 0, 0]);
  });
});
