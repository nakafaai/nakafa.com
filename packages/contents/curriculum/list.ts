import { MaterialCardDescriptionSchema } from "@repo/contents/material/description";
import { Schema, Struct } from "effect";

/**
 * One lesson of a curriculum card: its public path without the locale, and the
 * context hint of the curriculum that holds it, when the link carries one.
 */
const MaterialLessonLinkSchema = Schema.Struct({
  context: Schema.optionalKey(Schema.String),
  publicPath: Schema.String,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

const MaterialListItemSchema = Schema.Struct({
  title: Schema.String,
  description: MaterialCardDescriptionSchema,
  link: MaterialLessonLinkSchema,
  items: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      link: MaterialLessonLinkSchema,
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  ).pipe(Schema.mutable),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MaterialListSchema = Schema.Array(MaterialListItemSchema).pipe(
  Schema.mutable
);
export type MaterialList = typeof MaterialListSchema.Type;
