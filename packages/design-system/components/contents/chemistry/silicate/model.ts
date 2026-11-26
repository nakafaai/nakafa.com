import { Match, Schema } from "effect";

const SilicateMaterialSchema = Schema.Literals([
  "sodaLimeGlass",
  "borosilicateGlass",
  "traditionalCeramic",
  "advancedCeramic",
]);

export type SilicateMaterial = typeof SilicateMaterialSchema.Type;

const SilicateProfileSchema = Schema.Struct({
  hasBoron: Schema.Boolean,
  isAmorphous: Schema.Boolean,
  orderedCrystals: Schema.Boolean,
});

/** Characterise amorphous glass networks vs crystalline ceramic microstructures. */
export function evaluateSilicateLattice(
  material: SilicateMaterial
): typeof SilicateProfileSchema.Type {
  return Match.value(material).pipe(
    Match.when("sodaLimeGlass", () => ({
      hasBoron: false,
      isAmorphous: true,
      orderedCrystals: false,
    })),
    Match.when("borosilicateGlass", () => ({
      hasBoron: true,
      isAmorphous: true,
      orderedCrystals: false,
    })),
    Match.when("traditionalCeramic", () => ({
      hasBoron: false,
      isAmorphous: false,
      orderedCrystals: false,
    })),
    Match.when("advancedCeramic", () => ({
      hasBoron: false,
      isAmorphous: false,
      orderedCrystals: true,
    })),
    Match.exhaustive
  );
}
