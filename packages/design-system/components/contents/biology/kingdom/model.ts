import { Schema } from "effect";

export const SpecimenIdSchema = Schema.Literals([
  "sulfolobus",
  "thermus",
  "paramecium",
  "spirogyra",
  "slimeMould",
  "yeast",
  "mushroom",
  "fern",
  "padi",
  "hydra",
]);
export type SpecimenId = typeof SpecimenIdSchema.Type;

export const KingdomIdSchema = Schema.Literals([
  "archaebacteria",
  "eubacteria",
  "protista",
  "fungi",
  "plantae",
  "animalia",
]);
export type KingdomId = typeof KingdomIdSchema.Type;

export const KINGDOMS: readonly KingdomId[] = KingdomIdSchema.literals;

export const FeatureCheckSchema = Schema.Literals([
  "nucleus",
  "cells",
  "wall",
  "food",
]);
export type FeatureCheck = typeof FeatureCheckSchema.Type;

export const FeatureValueSchema = Schema.Literals([
  "yes",
  "no",
  "one",
  "many",
  "tissue",
  "none",
  "peptidoglycan",
  "noPeptidoglycan",
  "chitin",
  "cellulose",
  "photosynthesis",
  "absorbs",
  "ingests",
  "either",
]);
export type FeatureValue = typeof FeatureValueSchema.Type;

const SpecimenProfileSchema = Schema.Struct({
  cells: FeatureValueSchema,
  food: FeatureValueSchema,
  id: SpecimenIdSchema,
  kingdom: KingdomIdSchema,
  nucleus: FeatureValueSchema,
  wall: FeatureValueSchema,
});
export type SpecimenProfile = typeof SpecimenProfileSchema.Type;

/**
 * Diagnostic four-feature profiles for all ten specimens across the six
 * kingdoms: nucleus, cellularity/tissues, cell wall chemistry, and nutrition.
 */
const SPECIMEN_PROFILES: Readonly<Record<SpecimenId, SpecimenProfile>> = {
  fern: {
    cells: "tissue",
    food: "photosynthesis",
    id: "fern",
    kingdom: "plantae",
    nucleus: "yes",
    wall: "cellulose",
  },
  hydra: {
    cells: "tissue",
    food: "ingests",
    id: "hydra",
    kingdom: "animalia",
    nucleus: "yes",
    wall: "none",
  },
  mushroom: {
    cells: "many",
    food: "absorbs",
    id: "mushroom",
    kingdom: "fungi",
    nucleus: "yes",
    wall: "chitin",
  },
  padi: {
    cells: "tissue",
    food: "photosynthesis",
    id: "padi",
    kingdom: "plantae",
    nucleus: "yes",
    wall: "cellulose",
  },
  paramecium: {
    cells: "one",
    food: "ingests",
    id: "paramecium",
    kingdom: "protista",
    nucleus: "yes",
    wall: "none",
  },
  slimeMould: {
    cells: "many",
    food: "absorbs",
    id: "slimeMould",
    kingdom: "protista",
    nucleus: "yes",
    wall: "none",
  },
  spirogyra: {
    cells: "many",
    food: "photosynthesis",
    id: "spirogyra",
    kingdom: "protista",
    nucleus: "yes",
    wall: "cellulose",
  },
  sulfolobus: {
    cells: "one",
    food: "either",
    id: "sulfolobus",
    kingdom: "archaebacteria",
    nucleus: "no",
    wall: "noPeptidoglycan",
  },
  thermus: {
    cells: "one",
    food: "either",
    id: "thermus",
    kingdom: "eubacteria",
    nucleus: "no",
    wall: "peptidoglycan",
  },
  yeast: {
    cells: "one",
    food: "absorbs",
    id: "yeast",
    kingdom: "fungi",
    nucleus: "yes",
    wall: "chitin",
  },
};

/** Returns the four-feature profile and true kingdom for a specimen. */
export function specimenProfileOf(specimen: SpecimenId): SpecimenProfile {
  return SPECIMEN_PROFILES[specimen];
}

/** Checks whether placing `specimen` into `tray` matches its true kingdom. */
export function isPlacementRight(
  specimen: SpecimenId,
  tray: KingdomId
): boolean {
  return SPECIMEN_PROFILES[specimen].kingdom === tray;
}

/** 3D coordinates of each of the six kingdom trays along the front bench. */
export function kingdomTrayPosition(
  index: number
): readonly [number, number, number] {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return [(col - 1) * 1.12, 0, 0.35 + row * 0.72];
}
