import { LocaleSchema } from "@repo/contents/_types/content";
import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { MaterialCardDescriptionSchema } from "@repo/contents/_types/material/description";
import { PublicRouteSlugMapSchema } from "@repo/contents/_types/route/segment";
import { fieldsForEveryLocale } from "@repo/utilities/locales";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;
type SchemaEncoded<T extends Schema.Schema.Any> = Schema.Schema.Encoded<T>;

const MATERIAL_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MATERIAL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MATERIAL_ROUTE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const MaterialKeySchema = Schema.String.pipe(
  Schema.pattern(MATERIAL_KEY_PATTERN, {
    identifier: "MaterialKey",
    description: "Stable lowercase material key with dot or kebab separators.",
    message: () => "Invalid material key.",
  })
);

export type MaterialKey = SchemaType<typeof MaterialKeySchema>;

const MaterialSlugSchema = Schema.String.pipe(
  Schema.pattern(MATERIAL_SLUG_PATTERN, {
    identifier: "MaterialSlug",
    description: "Lowercase kebab-case route segment.",
    message: () => "Invalid material slug.",
  })
);

const MaterialRouteSchema = Schema.String.pipe(
  Schema.pattern(MATERIAL_ROUTE_PATTERN, {
    identifier: "MaterialRoute",
    description: "Normalized slash-separated route without a leading slash.",
    message: () => "Invalid material route.",
  })
);

const LocalizedTitleSchema = Schema.Struct({
  title: Schema.String,
});

const LocalizedDescriptionSchema = Schema.Struct({
  description: MaterialCardDescriptionSchema,
  title: Schema.String,
});

const LocaleTitleMapSchema = Schema.Struct(
  fieldsForEveryLocale(LocalizedTitleSchema)
);

const LocaleDescriptionMapSchema = Schema.Struct(
  fieldsForEveryLocale(LocalizedDescriptionSchema)
);

export const LessonMaterialSectionSchema = Schema.Struct({
  routeSlugs: PublicRouteSlugMapSchema,
  slug: MaterialSlugSchema,
  translations: LocaleTitleMapSchema,
});

export type LessonMaterialSection = SchemaType<
  typeof LessonMaterialSectionSchema
>;

export const LessonMaterialSourceSchema = Schema.Struct({
  assetRoot: MaterialRouteSchema,
  domain: MaterialSchema,
  key: MaterialKeySchema,
  kind: Schema.Literal("lesson"),
  routeSlugs: PublicRouteSlugMapSchema,
  sections: Schema.Array(LessonMaterialSectionSchema),
  slug: MaterialSlugSchema,
  translations: LocaleDescriptionMapSchema,
});

export type LessonMaterialSource = SchemaType<
  typeof LessonMaterialSourceSchema
>;
export type LessonMaterialSourceInput = SchemaEncoded<
  typeof LessonMaterialSourceSchema
>;

export const MaterialSourceSchema = LessonMaterialSourceSchema;

export type MaterialSource = SchemaType<typeof MaterialSourceSchema>;

export const MaterialLocaleSchema = LocaleSchema;
export type MaterialLocale = SchemaType<typeof MaterialLocaleSchema>;

/** Decodes one authored material lesson source at module load time. */
export function defineLessonMaterial(input: LessonMaterialSourceInput) {
  return Schema.decodeUnknownSync(LessonMaterialSourceSchema)(input);
}
