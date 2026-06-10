export const ARTICLE_CATEGORIES = ["politics"] as const;
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number];

export const SUBJECT_CATEGORIES = [
  "elementary-school",
  "middle-school",
  "high-school",
  "university",
] as const;
export type SubjectCategory = (typeof SUBJECT_CATEGORIES)[number];

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
export type NumericGrade = (typeof NUMERIC_GRADES)[number];

export const NON_NUMERIC_GRADES = ["bachelor", "master", "phd"] as const;
export type NonNumericGrade = (typeof NON_NUMERIC_GRADES)[number];

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
export type HighSchoolMaterial = (typeof HIGH_SCHOOL_MATERIALS)[number];

export const BACHELOR_MATERIALS = [
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations",
] as const;
export type BachelorMaterial = (typeof BACHELOR_MATERIALS)[number];

export const SUBJECT_MATERIALS = [
  ...HIGH_SCHOOL_MATERIALS,
  ...BACHELOR_MATERIALS,
] as const;
export type Material = (typeof SUBJECT_MATERIALS)[number];

export const EXERCISES_CATEGORIES = ["high-school", "middle-school"] as const;
export type ExercisesCategory = (typeof EXERCISES_CATEGORIES)[number];

export const EXERCISES_TYPES = ["grade-9", "tka", "snbt"] as const;
export type ExercisesType = (typeof EXERCISES_TYPES)[number];

export const EXERCISES_MATERIALS = [
  "mathematics",
  "quantitative-knowledge",
  "mathematical-reasoning",
  "general-reasoning",
  "indonesian-language",
  "english-language",
  "general-knowledge",
  "reading-and-writing-skills",
] as const;
export type ExercisesMaterial = (typeof EXERCISES_MATERIALS)[number];
