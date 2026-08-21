import { MaterialCardDescriptionSchema } from "@repo/contents/_types/material/description";
import { Schema, Struct } from "effect";

const MaterialListItemSchema = Schema.Struct({
  title: Schema.String,
  description: MaterialCardDescriptionSchema,
  href: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      href: Schema.String,
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  ).pipe(Schema.mutable),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const MaterialListSchema = Schema.Array(MaterialListItemSchema).pipe(
  Schema.mutable
);
export type MaterialList = Schema.Schema.Type<typeof MaterialListSchema>;
