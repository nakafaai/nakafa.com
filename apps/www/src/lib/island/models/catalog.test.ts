// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr, HashMap, HashSet, Option } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import { plantFaces, speciesFaces } from "@/lib/island/models/catalog";
import { PLANT_HEIGHTS } from "@/lib/island/models/heights";
import { LENGTHS } from "@/lib/island/models/lengths";
import {
  boundsOf,
  type Face,
  flatten,
  meters,
  normalOf,
} from "@/lib/island/models/parts";

const ANIMALS = Arr.map(SPECIES, (species, index) => ({
  faces: speciesFaces(index),
  species,
}));
const PLANTS = Arr.map(PLANT_KEYS, (key, index) => ({
  faces: plantFaces(index),
  key,
}));

/** A model as one string, to tell models apart. */
const drawingOf = (faces: readonly Face[]) =>
  Arr.join(
    Arr.map(Arr.fromIterable(flatten(faces)), (value) => value.toFixed(4)),
    ","
  );

/** How many triangles the renderer draws for a model: nine numbers a corner, three corners a triangle. */
const trianglesOf = (faces: readonly Face[]) => flatten(faces).length / 27;

/** Whether every face of a model is a real flat face with finite corners. */
const isSound = (faces: readonly Face[]) =>
  Arr.every(
    faces,
    (face) =>
      face.corners.length >= 3 &&
      Arr.every(face.corners, (corner) => Arr.every(corner, Number.isFinite)) &&
      Math.hypot(...normalOf(face.corners)) > 0.5
  );

/** The swimmers and fliers centered on their path; everything else stands on the ground. */
const AFLOAT = HashSet.make("fish", "eel", "ray", "snake");

/** One species' model, by its key. */
const byKey = (key: string) =>
  Option.getOrThrow(
    Arr.findFirst(ANIMALS, ({ species }) => species.key === key)
  );

describe("island/models/catalog", () => {
  it("builds every species as sound low-poly faces within a phone's budget, no two alike", () => {
    expect(ANIMALS).toHaveLength(SPECIES.length);
    expect(
      Arr.every(
        ANIMALS,
        ({ faces }) =>
          isSound(faces) && faces.length > 20 && trianglesOf(faces) <= 400
      )
    ).toBe(true);
    expect(
      HashSet.size(
        HashSet.fromIterable(Arr.map(ANIMALS, ({ faces }) => drawingOf(faces)))
      )
    ).toBe(SPECIES.length);
  });

  it("stands every walker on the ground and grows it to its real size", () => {
    const walkers = Arr.filter(
      ANIMALS,
      ({ species }) =>
        !HashSet.has(AFLOAT, species.family) && species.home !== "sea"
    );
    expect(walkers.length).toBeGreaterThan(120);
    expect(
      Arr.every(walkers, ({ faces }) => {
        const lowest = boundsOf(faces).y[0];
        return lowest > -0.005 && lowest < 0.02;
      })
    ).toBe(true);
    const tallest = (key: string) => boundsOf(byKey(key).faces).y[1];
    expect(tallest("giraffe")).toBeCloseTo(5, 5);
    expect(tallest("horse")).toBeLessThan(tallest("giraffe"));
    expect(tallest("mouse")).toBeLessThan(tallest("cat"));
  });

  it("grows every lizard and snake to its real length, so a crocodile outlasts a cottage door", () => {
    const longOnes = Arr.filter(
      ANIMALS,
      ({ species }) => species.family === "lizard" || species.family === "snake"
    );
    expect(
      Arr.every(longOnes, ({ species }) => HashMap.has(LENGTHS, species.key))
    ).toBe(true);
    const lengthOf = (key: string) => {
      const bounds = boundsOf(byKey(key).faces);
      return (bounds.z[1] - bounds.z[0]) * 0.9;
    };
    expect(lengthOf("komodo")).toBeCloseTo(2.6, 5);
    expect(lengthOf("crocodile")).toBeCloseTo(3.8, 5);
    expect(lengthOf("beaver")).toBeCloseTo(1.1, 5);
    expect(lengthOf("sea-snake")).toBeLessThan(1);
  });

  it("keeps the real-scale contract: a cow is 1.4 m at the shoulder and 2.4 m long", () => {
    const cow = byKey("cow");
    const bounds = boundsOf(cow.faces);
    expect(cow.species.height * 0.9).toBeCloseTo(1.44, 2);
    expect(
      Math.abs((bounds.z[1] - bounds.z[0]) * 0.9 - 2.4) / 2.4
    ).toBeLessThan(0.12);
    expect(bounds.y[1] * 0.9).toBeGreaterThan(1.44);
    expect(bounds.y[1] * 0.9).toBeLessThan(1.9);
  });

  it("builds every plant at its real height on the ground, no two alike", () => {
    expect(PLANTS).toHaveLength(PLANT_KEYS.length);
    expect(
      Arr.every(
        PLANTS,
        ({ faces }) => isSound(faces) && trianglesOf(faces) <= 400
      )
    ).toBe(true);
    expect(
      Arr.every(
        PLANTS,
        ({ faces, key }) =>
          Math.abs(boundsOf(faces).y[1] - meters(PLANT_HEIGHTS[key])) < 1e-9
      )
    ).toBe(true);
    expect(Arr.every(PLANTS, ({ faces }) => boundsOf(faces).y[0] > -0.05)).toBe(
      true
    );
    expect(
      HashSet.size(
        HashSet.fromIterable(Arr.map(PLANTS, ({ faces }) => drawingOf(faces)))
      )
    ).toBe(PLANT_KEYS.length);
  });
});
