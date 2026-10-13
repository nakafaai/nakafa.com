import { Schema } from "effect";

/** Her limbs, and the parts of her two arms that lie over her body. */
const LimbSchema = Schema.Literals([
  "armL",
  "armR",
  "leg0",
  "leg1",
  "leg2",
  "leg3",
  "overL",
  "overR",
]);

/** The layers of her figure, from the one behind her to the one over her. */
const PartSchema = Schema.Literals([
  "above",
  "back",
  "face",
  "front",
  "held",
  "legs",
  "upper",
]);

/**
 * What a shape of hers says about itself beyond how it is drawn: which limb it
 * is, which layer of the figure a group draws, or that it is an open eye, which
 * blinks.
 */
const MarkSchema = Schema.Union([
  Schema.TaggedStruct("limb", { name: LimbSchema }),
  Schema.TaggedStruct("part", { name: PartSchema }),
  Schema.TaggedStruct("eye", {}),
]);

export type Mark = typeof MarkSchema.Type;

/** The name of a limb, so a test can find it in her picture. */
export type LimbName = typeof LimbSchema.Type;

/** Marks a shape as one of her limbs. */
export function limbOf(name: LimbName): Mark {
  return { _tag: "limb", name };
}

/** Marks a group as one layer of her figure. */
export function partOf(name: typeof PartSchema.Type): Mark {
  return { _tag: "part", name };
}

/** Marks an open eye. */
export const EYE: Mark = { _tag: "eye" };
