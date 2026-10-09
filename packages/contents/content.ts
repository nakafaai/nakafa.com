import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type { ArticleReferenceSchema } from "@nakafa/aksara-contracts/projection/article";
import { Schema, Struct } from "effect";
/** Locale validation schema - single source of truth */
export const LocaleSchema = ActiveAppLocaleCodeSchema;
export type Locale = typeof LocaleSchema.Type;
/** Bibliography entry whose fields the reviewed Aksara article contract owns. */
export type Reference = typeof ArticleReferenceSchema.Type;
const ContentPaginationItemSchema = Schema.Struct({
  href: Schema.String,
  title: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const ContentPaginationSchema = Schema.Struct({
  prev: ContentPaginationItemSchema,
  next: ContentPaginationItemSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type ContentPagination = typeof ContentPaginationSchema.Type;
