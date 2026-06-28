import { MaterialCardDescriptionSchema } from "@repo/contents/_types/material/description";
import {
  BACHELOR_MATERIALS,
  HIGH_SCHOOL_MATERIALS,
} from "@repo/contents/_types/taxonomy";
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

export const MaterialListSchema = Schema.Array(MaterialListItemSchema).pipe(
  Schema.mutable
);
export type MaterialList = Schema.Schema.Type<typeof MaterialListSchema>;

const MaterialHighSchoolSchema = Schema.Literal(...HIGH_SCHOOL_MATERIALS);
const MaterialBachelorSchema = Schema.Literal(...BACHELOR_MATERIALS);

export const MaterialSchema = Schema.Union(
  MaterialHighSchoolSchema,
  MaterialBachelorSchema
);
