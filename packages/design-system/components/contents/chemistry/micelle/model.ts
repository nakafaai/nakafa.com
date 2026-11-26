import { Match, Schema } from "effect";

const MicelleStageSchema = Schema.Literals([
  "greaseOnFabric",
  "tailInsertion",
  "micelleLift",
  "rinseAway",
]);

export type MicelleStage = typeof MicelleStageSchema.Type;

const WaterTypeSchema = Schema.Literals(["soft", "hard"]);

export type WaterType = typeof WaterTypeSchema.Type;

const MicellePoseSchema = Schema.Struct({
  dropletY: Schema.Finite,
  hasScum: Schema.Boolean,
  soapCount: Schema.Int,
});

/** Evaluate oil-droplet elevation, surfactant coverage, and hard-water scum precipitation. */
export function evaluateMicelleCleaning(
  stage: MicelleStage,
  waterType: WaterType
): typeof MicellePoseSchema.Type {
  const hasScum = waterType === "hard";
  return Match.value(stage).pipe(
    Match.when("greaseOnFabric", () => ({
      dropletY: 0.24,
      hasScum,
      soapCount: 0,
    })),
    Match.when("tailInsertion", () => ({
      dropletY: 0.28,
      hasScum,
      soapCount: 6,
    })),
    Match.when("micelleLift", () => ({
      dropletY: hasScum ? 0.34 : 0.64,
      hasScum,
      soapCount: 10,
    })),
    Match.when("rinseAway", () => ({
      dropletY: hasScum ? 0.36 : 0.88,
      hasScum,
      soapCount: 10,
    })),
    Match.exhaustive
  );
}
