import { Schema } from "effect";

/** The bare metals a lab object is made of. Each has its own colour. */
export const MetalSchema = Schema.Literals([
  "aluminium",
  "brass",
  "chrome",
  "copper",
  "gold",
  "iron",
  "nichrome",
  "nickel",
  "solder",
  "steel",
  "tungsten",
]);

/** How a metal part was worked, which is the relief its surface carries. */
export const FinishSchema = Schema.Literals([
  "brushed",
  "cast",
  "knurled",
  "machined",
  "polished",
  "wound",
]);

/** What is the colour it was painted, dyed, glazed, moulded or lit in. */
const DyedSchema = Schema.Literals([
  "anodised",
  "ceramic",
  "cloth",
  "enamel",
  "epoxy",
  "felt",
  "lacquer",
  "light",
  "liquid",
  "paint",
  "plastic",
]);

/** What has a colour of its own, which a stain or a dye may still replace. */
const NativeSchema = Schema.Literals([
  "bakelite",
  "beech",
  "cork",
  "foam",
  "glass",
  "ice",
  "maple",
  "mercury",
  "mica",
  "oak",
  "paper",
  "porcelain",
  "rubber",
  "walnut",
  "wax",
]);

/** What every request for a material may also say. */
export const SHARED = {
  glow: Schema.optionalKey(Schema.Finite),
  opacity: Schema.optionalKey(Schema.Finite),
  thickness: Schema.optionalKey(Schema.Finite),
};

const MetalAskSchema = Schema.Struct({
  ...SHARED,
  finish: Schema.optionalKey(FinishSchema),
  of: MetalSchema,
});

export const DyedAskSchema = Schema.Struct({
  ...SHARED,
  color: Schema.String,
  of: DyedSchema,
});

export const NativeAskSchema = Schema.Struct({
  ...SHARED,
  color: Schema.optionalKey(Schema.String),
  of: NativeSchema,
});

/**
 * What an author says to get a material: what the part is made `of`, the
 * `finish` of a metal, the `color` of something painted or dyed, how brightly
 * it shines by itself as `glow` (0 is unlit; 1 is a lit lamp, or a metal as
 * hot as it is ever run), its `opacity` where it is not the material's own,
 * and the `thickness` of a clear wall that should bend the scene behind it.
 */
export const MatterSchema = Schema.Union([
  MetalAskSchema,
  DyedAskSchema,
  NativeAskSchema,
]);

/** Whether an author asked for a bare metal. */
export const isMetal = Schema.is(MetalAskSchema);

/** Whether an author asked for something painted, dyed, glazed, moulded or lit. */
export const isDyed = Schema.is(DyedAskSchema);
