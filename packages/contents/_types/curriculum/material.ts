import { MaterialCardDescriptionSchema } from "@repo/contents/_types/material/description";
import { Schema } from "effect";

const MaterialListItemSchema = Schema.Struct({
  title: Schema.String,
  description: MaterialCardDescriptionSchema,
  href: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      href: Schema.String,
    }).pipe(Schema.mutable)
  ).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const MaterialListSchema = Schema.Array(MaterialListItemSchema).pipe(
  Schema.mutable
);
export type MaterialList = Schema.Schema.Type<typeof MaterialListSchema>;
