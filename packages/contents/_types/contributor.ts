import { Schema } from "effect";

const UrlStringSchema = Schema.String.pipe(
  Schema.filter((value) => URL.canParse(value), {
    message: () => "Expected a valid URL.",
  })
);

export const CONTRIBUTOR_TYPES = [
  "official",
  "former-official",
  "community",
] as const;

export const ContributorSchema = Schema.Struct({
  name: Schema.String,
  username: Schema.String,
  type: Schema.Literal(...CONTRIBUTOR_TYPES),
  social: Schema.optional(
    Schema.Struct({
      twitter: Schema.optional(UrlStringSchema),
      github: Schema.optional(UrlStringSchema),
      linkedin: Schema.optional(UrlStringSchema),
    }).pipe(Schema.mutable)
  ),
}).pipe(Schema.mutable);

export type Contributor = Schema.Schema.Type<typeof ContributorSchema>;
