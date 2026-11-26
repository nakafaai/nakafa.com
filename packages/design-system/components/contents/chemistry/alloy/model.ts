import { Match, Schema } from "effect";

const AlloyMetalSchema = Schema.Literals([
  "pureIron",
  "steel",
  "bronze",
  "brass",
]);

export type AlloyMetal = typeof AlloyMetalSchema.Type;

const SlipReadingSchema = Schema.Struct({
  foreignRadius: Schema.Finite,
  hasForeignAtoms: Schema.Boolean,
  layerShift: Schema.Finite,
});

/** Compute atomic slip-plane displacement under shear force for pure metals vs alloys. */
export function evaluateAlloySlip(
  metal: AlloyMetal,
  shearForce: number
): typeof SlipReadingSchema.Type {
  const force = Math.min(100, Math.max(0, shearForce)) / 100;
  return Match.value(metal).pipe(
    Match.when("pureIron", () => ({
      foreignRadius: 0,
      hasForeignAtoms: false,
      layerShift: Number((force * 0.42).toFixed(3)),
    })),
    Match.when("steel", () => ({
      foreignRadius: 0.055,
      hasForeignAtoms: true,
      layerShift: Number((force * 0.06).toFixed(3)),
    })),
    Match.when("bronze", () => ({
      foreignRadius: 0.125,
      hasForeignAtoms: true,
      layerShift: Number((force * 0.08).toFixed(3)),
    })),
    Match.when("brass", () => ({
      foreignRadius: 0.115,
      hasForeignAtoms: true,
      layerShift: Number((force * 0.1).toFixed(3)),
    })),
    Match.exhaustive
  );
}
