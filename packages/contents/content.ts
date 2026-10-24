import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import type { ArticleReferenceSchema } from "@nakafa/aksara-contracts/projection/article";
import { Schema, Struct } from "effect";
/** Locale validation schema - single source of truth */
export const LocaleSchema = ActiveAppLocaleCodeSchema;
export type Locale = typeof LocaleSchema.Type;
/** Bibliography entry whose fields the reviewed Aksara article contract owns. */
export type Reference = typeof ArticleReferenceSchema.Type;
/**
 * One neighbouring page. Its public path names the page without its locale, and
 * an empty path names no page. A material page may carry the context hint of its
 * curriculum, which the link keeps in its search.
 */
const ContentPaginationItemSchema = Schema.Struct({
  context: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
  title: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const ContentPaginationSchema = Schema.Struct({
  prev: ContentPaginationItemSchema,
  next: ContentPaginationItemSchema,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type ContentPagination = typeof ContentPaginationSchema.Type;
