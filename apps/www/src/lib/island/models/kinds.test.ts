// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { plantFaces, speciesFaces } from "@/lib/island/models/catalog";
import {
  BodyKind,
  bodyFaces,
  modelFaces,
  modelKey,
} from "@/lib/island/models/kinds";
import { swimmerFaces } from "@/lib/island/models/ocean";
import { boundsOf, flatten, meters } from "@/lib/island/models/parts";
import { SCALE } from "@/lib/island/scale";

/** A body's measure in meters along one axis. */
const span = (range: readonly [number, number]) =>
  (range[1] - range[0]) * SCALE.block;

describe("island/models/kinds", () => {
  it("builds every body at its real size, standing on the ground it is placed on", () => {
    const sizes = Arr.map(
      BodyKind.literals,
      (kind) => [kind, boundsOf(bodyFaces(kind))] as const
    );
    for (const [kind, bounds] of sizes) {
      if (kind !== "whale") {
        expect(bounds.y[0]).toBeCloseTo(0, 6);
      }
    }
    const of = (kind: BodyKind) => boundsOf(bodyFaces(kind));
    // A person stands 1.62 m to the top of the head, and a cat's ears reach 1.8 m, two blocks.
    expect(of("cat").y[1]).toBeCloseTo(meters(1.8), 6);
    expect(of("fox").y[1]).toBeCloseTo(SCALE.person, 6);
    expect(span(of("rabbit").y)).toBeGreaterThan(1.9);
    // A cow is 1.4 m at the shoulder, about 2.4 m long, and taller with its head up.
    expect(span(of("cow").z)).toBeGreaterThan(2.3);
    expect(span(of("cow").z)).toBeLessThan(2.5);
    expect(span(of("cow").y)).toBeGreaterThan(1.4);
    // Fowl are about 45 cm, a whale about 13 m from head to flukes.
    expect(span(of("hen").y)).toBeCloseTo(0.5, 1);
    expect(span(of("whale").z)).toBeGreaterThan(12.5);
    expect(span(of("whale").z)).toBeLessThan(14.5);
  });

  it("draws every body as whole triangles", () => {
    for (const kind of BodyKind.literals) {
      expect(flatten(bodyFaces(kind)).length % (3 * 9)).toBe(0);
    }
  });

  it("builds every model the world draws from its own maker, kept under one key a model", () => {
    const models = [
      { _tag: "body", kind: "cow" },
      { _tag: "species", index: 3 },
      { _tag: "swimmer", kind: "orca" },
      { _tag: "plant", index: 0 },
    ] as const;
    expect(Arr.map(models, modelFaces)).toEqual([
      bodyFaces("cow"),
      speciesFaces(3),
      swimmerFaces("orca"),
      plantFaces(0),
    ]);
    expect(Arr.map(models, modelKey)).toEqual([
      "body-cow",
      "species-3",
      "swimmer-orca",
      "plant-0",
    ]);
  });
});
