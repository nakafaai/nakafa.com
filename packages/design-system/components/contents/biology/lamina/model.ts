import { Match, Schema } from "effect";

const LeafLayerSchema = Schema.Literals([
  "cuticle",
  "upperEpidermis",
  "palisade",
  "spongy",
  "vascular",
  "lowerEpidermis",
  "stoma",
]);

export type LeafLayer = typeof LeafLayerSchema.Type;

const ChloroplastDensitySchema = Schema.Literals([
  "high",
  "moderate",
  "guardOnly",
  "none",
]);

export type ChloroplastDensity = typeof ChloroplastDensitySchema.Type;

const LeafLayerSpecSchema = Schema.Struct({
  density: ChloroplastDensitySchema,
  focusY: Schema.Finite,
});

export type LeafLayerSpec = typeof LeafLayerSpecSchema.Type;

/** Chloroplast density and vertical focus height for each leaf cross-section layer. */
export function leafLayerSpec(layer: LeafLayer): LeafLayerSpec {
  return Match.value(layer).pipe(
    Match.when("cuticle", () => ({ density: "none" as const, focusY: 1.24 })),
    Match.when("upperEpidermis", () => ({
      density: "none" as const,
      focusY: 1.08,
    })),
    Match.when("palisade", () => ({ density: "high" as const, focusY: 0.82 })),
    Match.when("spongy", () => ({
      density: "moderate" as const,
      focusY: 0.46,
    })),
    Match.when("vascular", () => ({ density: "none" as const, focusY: 0.56 })),
    Match.when("lowerEpidermis", () => ({
      density: "none" as const,
      focusY: 0.18,
    })),
    Match.when("stoma", () => ({
      density: "guardOnly" as const,
      focusY: 0.14,
    })),
    Match.exhaustive
  );
}
