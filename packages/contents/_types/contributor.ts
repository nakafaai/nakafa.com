import { Schema, Struct } from "effect";

const UrlStringSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter((value) => URL.canParse(value), {
      message: "Expected a valid URL.",
    })
  )
);
const CONTRIBUTOR_TYPES = ["official", "former-official", "community"] as const;
const ContributorSchema = Schema.Struct({
  name: Schema.String,
  username: Schema.String,
  type: Schema.Literals(CONTRIBUTOR_TYPES),
  social: Schema.optional(
    Schema.Struct({
      twitter: Schema.optional(UrlStringSchema),
      github: Schema.optional(UrlStringSchema),
      linkedin: Schema.optional(UrlStringSchema),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type Contributor = Schema.Schema.Type<typeof ContributorSchema>;
