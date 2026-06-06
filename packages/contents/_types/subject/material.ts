import { Schema } from "effect";

const MaterialListItemSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  href: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      href: Schema.String,
    }).pipe(Schema.mutable)
  ).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export const MaterialListSchema = Schema.Array(MaterialListItemSchema).pipe(
  Schema.mutable
);
export type MaterialList = Schema.Schema.Type<typeof MaterialListSchema>;

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

const MaterialHighSchoolSchema = Schema.Literal(...HIGH_SCHOOL_MATERIALS);
export type MaterialHighSchool = Schema.Schema.Type<
  typeof MaterialHighSchoolSchema
>;

const MaterialBachelorSchema = Schema.Literal(...BACHELOR_MATERIALS);
export type MaterialBachelor = Schema.Schema.Type<
  typeof MaterialBachelorSchema
>;

export const MaterialSchema = Schema.Union(
  MaterialHighSchoolSchema,
  MaterialBachelorSchema
);
export type Material = Schema.Schema.Type<typeof MaterialSchema>;
