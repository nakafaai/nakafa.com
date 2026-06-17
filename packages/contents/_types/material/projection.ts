import {
  type ExercisesMaterialList,
  ExercisesMaterialSchema,
} from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import { LocaleSchema } from "@repo/contents/_types/content";
import {
  type MaterialList,
  MaterialSchema,
} from "@repo/contents/_types/curriculum/material";
import type {
  LessonMaterialSource,
  MaterialLocale,
  MaterialSource,
  PracticeMaterialGroup,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
import {
  MaterialKeySchema,
  MaterialLocaleSchema,
} from "@repo/contents/_types/material/schema";
import { cleanSlug } from "@repo/utilities/helper";
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
  description: Schema.optional(Schema.String),
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

export const PracticeMaterialSetProjectionSchema = Schema.Struct({
  assessment: ExercisesTypeSchema,
  description: Schema.optional(Schema.String),
  domain: ExercisesMaterialSchema,
  exerciseType: Schema.String,
  exerciseTypeTitle: Schema.String,
  locale: LocaleSchema,
  setName: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  year: Schema.optional(Schema.Int.pipe(Schema.between(2000, 2100))),
});

export type PracticeMaterialSetProjection = SchemaType<
  typeof PracticeMaterialSetProjectionSchema
>;

/** Returns the localized lesson navigation list expected by material pages. */
export function toLessonMaterialList(
  material: LessonMaterialSource,
  locale: MaterialLocale
): MaterialList {
  return [
    {
      ...readDescriptionTranslation(material, locale),
      href: `/${material.assetRoot}`,
      items: material.sections.map((section) => ({
        href: `/${material.assetRoot}/${section.slug}`,
        title: section.translations[locale].title,
      })),
    },
  ];
}

/** Returns the localized practice navigation list expected by assessment pages. */
export function toPracticeMaterialList(
  material: PracticeMaterialSource,
  locale: MaterialLocale
): ExercisesMaterialList {
  return material.groups.map((group) => {
    const groupRoute = getExerciseGroupRoute(material, group);

    return {
      ...readDescriptionTranslation(group, locale),
      href: `/${groupRoute}`,
      items: group.sets.map((set) => ({
        href: `/${groupRoute}/${set.slug}`,
        title: set.translations[locale].title,
      })),
    };
  });
}

/** Projects all lesson material sources into sync-ready rows. */
export function listLessonMaterials(
  materials: readonly MaterialSource[],
  locale?: MaterialLocale
) {
  return materials.flatMap((material) => {
    if (material.kind !== "lesson") {
      return [];
    }

    const locales: MaterialLocale[] =
      locale === undefined ? ["en", "id"] : [locale];

    return locales.map((materialLocale) =>
      toLessonMaterialProjection(material, materialLocale)
    );
  });
}

/** Projects all practice material sources into sync-ready set rows. */
export function listPracticeMaterialSets(
  materials: readonly MaterialSource[],
  locale?: MaterialLocale
) {
  return materials.flatMap((material) => {
    if (material.kind !== "practice") {
      return [];
    }

    const locales: MaterialLocale[] =
      locale === undefined ? ["en", "id"] : [locale];

    return locales.flatMap((materialLocale) =>
      material.groups.flatMap((group) =>
        group.sets.map((set) => {
          const groupRoute = getExerciseGroupRoute(material, group);

          return {
            assessment: material.assessment,
            description: group.translations[materialLocale].description,
            domain: material.domain,
            exerciseType: group.exerciseType,
            exerciseTypeTitle: group.translations[materialLocale].title,
            locale: materialLocale,
            setName: set.slug,
            slug: `${groupRoute}/${set.slug}`,
            title: set.translations[materialLocale].title,
            ...(group.year === undefined ? {} : { year: group.year }),
          };
        })
      )
    );
  });
}

/** Finds one material whose asset root matches the requested public route. */
export function findMaterialSourceByRoute(
  materials: readonly MaterialSource[],
  kind: MaterialSource["kind"],
  route: string
) {
  const normalizedRoute = normalizeMaterialRoute(route);

  return (
    materials.find((material) => {
      if (material.kind !== kind) {
        return false;
      }

      return (
        normalizedRoute === material.assetRoot ||
        normalizedRoute.startsWith(`${material.assetRoot}/`)
      );
    }) ?? null
  );
}

/** Normalizes a route so materials do not depend on leading slash differences. */
export function normalizeMaterialRoute(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
}

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

function getExerciseGroupRoute(
  material: PracticeMaterialSource,
  group: PracticeMaterialGroup
) {
  const exerciseType =
    group.year === undefined
      ? group.exerciseType
      : `${group.exerciseType}-${group.year}`;
  const segments = [material.assetRoot, exerciseType];

  return segments.join("/");
}

function readDescriptionTranslation(
  item: Pick<LessonMaterialSource | PracticeMaterialGroup, "translations">,
  locale: MaterialLocale
) {
  const translation = item.translations[locale];

  return {
    ...(translation.description === undefined
      ? {}
      : { description: translation.description }),
    title: translation.title,
  };
}
