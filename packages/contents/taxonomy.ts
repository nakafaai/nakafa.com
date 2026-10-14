import { Schema } from "effect";

const NUMERIC_GRADES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;
export const NON_NUMERIC_GRADES = ["bachelor", "master", "phd"] as const;

const GRADES = [...NUMERIC_GRADES, ...NON_NUMERIC_GRADES] as const;
export const GradeSchema = Schema.Literals(GRADES);
export type Grade = typeof GradeSchema.Type;

/** The subjects that the high school curriculum teaches. */
export const HIGH_SCHOOL_MATERIALS = [
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economy",
  "history",
  "informatics",
  "geospatial",
  "sociology",
] as const;
/** The subjects that the bachelor programs teach. */
export const BACHELOR_MATERIALS = [
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations",
] as const;
const SUBJECT_MATERIALS = [
  ...HIGH_SCHOOL_MATERIALS,
  ...BACHELOR_MATERIALS,
] as const;
export const MaterialSchema = Schema.Literals(SUBJECT_MATERIALS);
type Material = typeof MaterialSchema.Type;

/** Material domains with Nakafa-owned presentation labels and icons. */
export const PRESENTED_MATERIAL_DOMAINS = SUBJECT_MATERIALS;
export type PresentedMaterialDomain = Material;

/** Whether a key names one of the material domains that Nakafa presents. */
export const isPresentedMaterialDomain = Schema.is(MaterialSchema);
