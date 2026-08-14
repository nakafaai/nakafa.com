export const NUMERIC_GRADES = [
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

export const GRADES = [...NUMERIC_GRADES, ...NON_NUMERIC_GRADES] as const;
export type Grade = (typeof GRADES)[number];

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
export const BACHELOR_MATERIALS = [
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations",
] as const;
export const SUBJECT_MATERIALS = [
  ...HIGH_SCHOOL_MATERIALS,
  ...BACHELOR_MATERIALS,
] as const;
export type Material = (typeof SUBJECT_MATERIALS)[number];

/** Material domains with Nakafa-owned presentation labels and icons. */
export const PRESENTED_MATERIAL_DOMAINS = SUBJECT_MATERIALS;
export type PresentedMaterialDomain =
  (typeof PRESENTED_MATERIAL_DOMAINS)[number];
