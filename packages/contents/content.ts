import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import { Schema, Struct } from "effect";
/** Locale validation schema - single source of truth */
export const LocaleSchema = ActiveAppLocaleCodeSchema;
export type Locale = typeof LocaleSchema.Type;
const ReferenceSchema = Schema.Struct({
  title: Schema.String,
  authors: Schema.String,
  year: Schema.Finite,
  url: Schema.optional(Schema.String),
  citation: Schema.optional(Schema.String),
  publication: Schema.optional(Schema.String),
  details: Schema.optional(Schema.String),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type Reference = typeof ReferenceSchema.Type;
const ContentPaginationItemSchema = Schema.Struct({
  href: Schema.String,
  title: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const ContentPaginationSchema = Schema.Struct({
  prev: ContentPaginationItemSchema,
  next: ContentPaginationItemSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type ContentPagination = typeof ContentPaginationSchema.Type;
