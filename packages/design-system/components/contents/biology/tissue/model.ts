import { Match, Schema } from "effect";

const PlantTissueSchema = Schema.Literals([
  "meristem",
  "epidermis",
  "parenchyma",
  "collenchyma",
  "sclerenchyma",
  "xylem",
  "phloem",
]);

export type PlantTissue = typeof PlantTissueSchema.Type;

const TissueStatusSchema = Schema.Literals(["living", "dead"]);

export type TissueStatus = typeof TissueStatusSchema.Type;

const TissueProfileSchema = Schema.Struct({
  lignified: Schema.Boolean,
  status: TissueStatusSchema,
  wallScale: Schema.Finite,
});

export type TissueProfile = typeof TissueProfileSchema.Type;

/** Structural profile of each plant tissue type for the 3D cutaway block. */
export function tissueProfile(tissue: PlantTissue): TissueProfile {
  return Match.value(tissue).pipe(
    Match.when("meristem", () => ({
      lignified: false,
      status: "living" as const,
      wallScale: 0.25,
    })),
    Match.when("epidermis", () => ({
      lignified: false,
      status: "living" as const,
      wallScale: 0.35,
    })),
    Match.when("parenchyma", () => ({
      lignified: false,
      status: "living" as const,
      wallScale: 0.3,
    })),
    Match.when("collenchyma", () => ({
      lignified: false,
      status: "living" as const,
      wallScale: 0.65,
    })),
    Match.when("sclerenchyma", () => ({
      lignified: true,
      status: "dead" as const,
      wallScale: 1,
    })),
    Match.when("xylem", () => ({
      lignified: true,
      status: "dead" as const,
      wallScale: 0.9,
    })),
    Match.when("phloem", () => ({
      lignified: false,
      status: "living" as const,
      wallScale: 0.45,
    })),
    Match.exhaustive
  );
}
