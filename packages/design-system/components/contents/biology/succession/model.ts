import { Match, Schema } from "effect";

const SuccessionPathwaySchema = Schema.Literals(["primary", "secondary"]);

export type SuccessionPathway = typeof SuccessionPathwaySchema.Type;

const SuccessionStageSchema = Schema.Literals([
  "bareRock",
  "lichenMoss",
  "grassShrub",
  "youngWoodland",
  "climaxForest",
]);

export type SuccessionStage = typeof SuccessionStageSchema.Type;

const SuccessionMetricSchema = Schema.Struct({
  biodiversityIndex: Schema.Finite,
  canopyHeightM: Schema.Finite,
  soilDepthCm: Schema.Finite,
});

/** Compute topsoil thickness, canopy height, and biodiversity index across succession stages. */
export function evaluateSuccessionStage(
  pathway: SuccessionPathway,
  stage: SuccessionStage
): typeof SuccessionMetricSchema.Type {
  const soilBonus = pathway === "secondary" ? 12 : 0;
  return Match.value(stage).pipe(
    Match.when("bareRock", () => ({
      biodiversityIndex: pathway === "secondary" ? 0.18 : 0.02,
      canopyHeightM: 0,
      soilDepthCm: soilBonus,
    })),
    Match.when("lichenMoss", () => ({
      biodiversityIndex: 0.25,
      canopyHeightM: 0.2,
      soilDepthCm: 4 + soilBonus,
    })),
    Match.when("grassShrub", () => ({
      biodiversityIndex: 0.52,
      canopyHeightM: 1.8,
      soilDepthCm: 14 + soilBonus,
    })),
    Match.when("youngWoodland", () => ({
      biodiversityIndex: 0.78,
      canopyHeightM: 9.5,
      soilDepthCm: 28 + soilBonus,
    })),
    Match.when("climaxForest", () => ({
      biodiversityIndex: 0.94,
      canopyHeightM: 22,
      soilDepthCm: 45 + soilBonus,
    })),
    Match.exhaustive
  );
}
