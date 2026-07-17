import { MaterialSchema } from "@repo/contents/_types/curriculum/material";
import { MaterialCardDescriptionSchema } from "@repo/contents/_types/material/description";
import type {
  LessonMaterialSource,
  MaterialLocale,
  MaterialSource,
} from "@repo/contents/_types/material/schema";
import {
  MaterialKeySchema,
  MaterialLocaleSchema,
} from "@repo/contents/_types/material/schema";
import { cleanSlug } from "@repo/utilities/helper";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

type SchemaType<T extends Schema.Schema.Any> = Schema.Schema.Type<T>;

export const LessonMaterialSectionProjectionSchema = Schema.Struct({
  order: Schema.Int.pipe(Schema.nonNegative()),
  section: Schema.String,
  slug: Schema.String,
});

export type LessonMaterialSectionProjection = SchemaType<
  typeof LessonMaterialSectionProjectionSchema
>;

export const LessonMaterialProjectionSchema = Schema.Struct({
  description: MaterialCardDescriptionSchema,
  domain: MaterialSchema,
  key: MaterialKeySchema,
  locale: MaterialLocaleSchema,
  order: Schema.Int.pipe(Schema.nonNegative()),
  sections: Schema.Array(LessonMaterialSectionProjectionSchema),
  slug: Schema.String,
  title: Schema.String,
  topic: Schema.String,
});

export type LessonMaterialProjection = SchemaType<
  typeof LessonMaterialProjectionSchema
>;

/** Projects all lesson material sources into sync-ready rows. */
export function listLessonMaterials(
  materials: readonly MaterialSource[],
  locale?: MaterialLocale
) {
  return materials.flatMap((material) => {
    const materialLocales: readonly MaterialLocale[] =
      locale === undefined ? locales : [locale];

    return materialLocales.map((materialLocale) =>
      toLessonMaterialProjection(material, materialLocale)
    );
  });
}

/** Finds one material whose asset root matches the requested public route. */
export function findMaterialSourceByRoute(
  materials: readonly MaterialSource[],
  route: string
) {
  const normalizedRoute = normalizeMaterialRoute(route);

  return (
    materials.find(
      (material) =>
        normalizedRoute === material.assetRoot ||
        normalizedRoute.startsWith(`${material.assetRoot}/`)
    ) ?? null
  );
}

/** Normalizes a route so materials do not depend on leading slash differences. */
export function normalizeMaterialRoute(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
}

/**
 * Projects one lesson material source into a locale-specific material row while
 * preserving the authored section order that drives lessons, pagination, and
 * route lookup.
 */
function toLessonMaterialProjection(
  material: LessonMaterialSource,
  locale: MaterialLocale
): LessonMaterialProjection {
  return {
    description: material.translations[locale].description,
    domain: material.domain,
    key: material.key,
    locale,
    order: 0,
    sections: material.sections.map((section, sectionOrder) => ({
      order: sectionOrder,
      section: section.slug,
      slug: `${material.assetRoot}/${section.slug}`,
    })),
    slug: material.assetRoot,
    title: material.translations[locale].title,
    topic: material.slug,
  };
}
