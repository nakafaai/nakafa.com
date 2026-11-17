// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order } from "effect";
import { boundsOf, flatten, MODEL_STRIDE } from "@/lib/island/models/parts";
import { LOOKS, ReefKind, reefFaces } from "@/lib/island/models/reef";

/** Every look of every kind, built. */
const MODELS = Arr.flatMap(ReefKind.literals, (kind) =>
  Arr.makeBy(LOOKS, (look) => ({ faces: reefFaces(kind, look), kind, look }))
);

/** The modes of every corner of a model, as the body program reads them. */
const modesOf = (faces: ReturnType<typeof reefFaces>) =>
  Arr.dedupe(
    Arr.map(
      Arr.chunksOf(Arr.fromIterable(flatten(faces)), MODEL_STRIDE),
      (corner) => corner[12]
    )
  );

/**
 * How much water each kind's zone holds over its floor, in blocks (ADR 0047,
 * D50): the shelf under two blocks of sea, the crest under four, the kelp's
 * deep fringe under six, less the sea's surface a little under the top
 * block's face.
 */
const WATER = {
  anemone: 0.875,
  brain: 0.875,
  branching: 0.875,
  fan: 2.875,
  kelp: 4.875,
  seagrass: 0.875,
  sponge: 2.875,
  table: 2.875,
} as const;

describe("island/models/reef", () => {
  it("builds every look of every kind as whole triangles rooted at the floor, each look its own shape", () => {
    Arr.forEach(MODELS, ({ faces }) => {
      const corners = flatten(faces);
      expect(corners.length).toBeGreaterThan(0);
      expect(corners.length % (MODEL_STRIDE * 3)).toBe(0);
      expect(boundsOf(faces).y[0]).toBeLessThan(0.1);
    });
    Arr.forEach(ReefKind.literals, (kind) => {
      const looks = Arr.map(
        Arr.filter(MODELS, (model) => model.kind === kind),
        (model) =>
          Arr.join(Arr.map(Arr.fromIterable(flatten(model.faces)), String), ",")
      );
      expect(Arr.dedupe(looks)).toHaveLength(LOOKS);
    });
  });

  it("keeps everything rooted on the sea floor under the water of its zone", () => {
    Arr.forEach(MODELS, ({ faces, kind }) => {
      if (kind !== "lily") {
        // The tallest sways a little more, so each keeps a tenth of a block clear of the surface.
        expect(boundsOf(faces).y[1]).toBeLessThan(WATER[kind] - 0.1);
      }
    });
  });

  it("floats lily pads flat on the water, a flower cupped up above a pad", () => {
    const [pads, pink, white] = Arr.map(
      Arr.filter(MODELS, (model) => model.kind === "lily"),
      ({ faces }) => boundsOf(faces)
    );
    expect(pads.y[1] - pads.y[0]).toBeLessThan(0.01);
    expect(pink.y[1]).toBeGreaterThan(0.08);
    expect(white.y[1]).toBeGreaterThan(0.08);
  });

  it("sways kelp, seagrass, sea fans and an anemone's tentacles in the current, bobs a lily pad, and holds a stony coral still", () => {
    const modes = (kind: ReefKind) =>
      Arr.dedupe(
        Arr.flatMap(
          Arr.filter(MODELS, (model) => model.kind === kind),
          (model: (typeof MODELS)[number]) => modesOf(model.faces)
        )
      );
    const swaying: readonly ReefKind[] = ["kelp", "seagrass", "fan"];
    const stony: readonly ReefKind[] = [
      "branching",
      "table",
      "brain",
      "sponge",
    ];
    Arr.forEach(swaying, (kind) => expect(modes(kind)).toEqual([6]));
    expect(Arr.sort(modes("anemone"), Order.Number)).toEqual([0, 6]);
    expect(modes("lily")).toEqual([2]);
    Arr.forEach(stony, (kind) => expect(modes(kind)).toEqual([0]));
  });
});
