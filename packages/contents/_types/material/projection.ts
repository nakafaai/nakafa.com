import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import type {
  ExerciseMaterialGroup,
  ExerciseMaterialSource,
  MaterialLocale,
  MaterialSource,
  SubjectMaterialSource,
  SubjectMaterialTopic,
} from "@repo/contents/_types/material/schema";
import type { MaterialList } from "@repo/contents/_types/subject/material";
import { cleanSlug } from "@repo/utilities/helper";

/** Sync-ready subject topic projected from the typed Material source. */
export interface SubjectMaterialTopicProjection {
  category: SubjectMaterialSource["category"];
  description?: string;
  grade: SubjectMaterialSource["grade"];
  locale: MaterialLocale;
  material: SubjectMaterialSource["material"];
  order: number;
  sections: SubjectMaterialSectionProjection[];
  slug: string;
  title: string;
  topic: string;
}

/** Sync-ready subject section order projected from the typed Material source. */
export interface SubjectMaterialSectionProjection {
  order: number;
  section: string;
  slug: string;
}

/** Sync-ready exercise set projected from the typed Material source. */
export interface ExerciseMaterialSetProjection {
  category: ExerciseMaterialSource["category"];
  description?: string;
  exerciseType: string;
  exerciseTypeTitle: string;
  locale: MaterialLocale;
  material: ExerciseMaterialSource["material"];
  setName: string;
  slug: string;
  title: string;
  type: ExerciseMaterialSource["type"];
  year?: number;
}

/** Returns the localized subject navigation list expected by lesson pages. */
export function toSubjectMaterialList(
  material: SubjectMaterialSource,
  locale: MaterialLocale
): MaterialList {
  return material.topics.map((topic) => ({
    ...readDescriptionTranslation(topic, locale),
    href: `/${material.baseRoute}/${topic.slug}`,
    items: topic.sections.map((section) => ({
      href: `/${material.baseRoute}/${topic.slug}/${section.slug}`,
      title: section.translations[locale].title,
    })),
  }));
}

/** Returns the localized exercise navigation list expected by exercise pages. */
export function toExerciseMaterialList(
  material: ExerciseMaterialSource,
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

/** Projects all subject material sources into sync-ready topic rows. */
export function listSubjectMaterialTopics(
  materials: readonly MaterialSource[],
  locale?: MaterialLocale
) {
  return materials.flatMap((material) => {
    if (material.kind !== "subject") {
      return [];
    }

    const locales: MaterialLocale[] =
      locale === undefined ? ["en", "id"] : [locale];

    return locales.flatMap((materialLocale) =>
      material.topics.map((topic, order) =>
        toSubjectMaterialTopicProjection(material, topic, materialLocale, order)
      )
    );
  });
}

/** Projects all exercise material sources into sync-ready set rows. */
export function listExerciseMaterialSets(
  materials: readonly MaterialSource[],
  locale?: MaterialLocale
) {
  return materials.flatMap((material) => {
    if (material.kind !== "exercise") {
      return [];
    }

    const locales: MaterialLocale[] =
      locale === undefined ? ["en", "id"] : [locale];

    return locales.flatMap((materialLocale) =>
      material.groups.flatMap((group) =>
        group.sets.map((set) => {
          const groupRoute = getExerciseGroupRoute(material, group);

          return {
            category: material.category,
            description: group.translations[materialLocale].description,
            exerciseType: group.exerciseType,
            exerciseTypeTitle: group.translations[materialLocale].title,
            locale: materialLocale,
            material: material.material,
            setName: set.slug,
            slug: `${groupRoute}/${set.slug}`,
            title: set.translations[materialLocale].title,
            type: material.type,
            ...(group.year === undefined ? {} : { year: group.year }),
          };
        })
      )
    );
  });
}

/** Finds one material whose base route matches the requested public route. */
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
        normalizedRoute === material.baseRoute ||
        normalizedRoute.startsWith(`${material.baseRoute}/`)
      );
    }) ?? null
  );
}

/** Normalizes a route so materials do not depend on leading slash differences. */
export function normalizeMaterialRoute(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
}

function toSubjectMaterialTopicProjection(
  material: SubjectMaterialSource,
  topic: SubjectMaterialTopic,
  locale: MaterialLocale,
  order: number
): SubjectMaterialTopicProjection {
  return {
    category: material.category,
    description: topic.translations[locale].description,
    grade: material.grade,
    locale,
    material: material.material,
    order,
    sections: topic.sections.map((section, sectionOrder) => ({
      order: sectionOrder,
      section: section.slug,
      slug: `${material.baseRoute}/${topic.slug}/${section.slug}`,
    })),
    slug: `${material.baseRoute}/${topic.slug}`,
    title: topic.translations[locale].title,
    topic: topic.slug,
  };
}

function getExerciseGroupRoute(
  material: ExerciseMaterialSource,
  group: ExerciseMaterialGroup
) {
  const segments = [material.baseRoute, group.exerciseType];

  if (group.year !== undefined) {
    segments.push(String(group.year));
  }

  return segments.join("/");
}

function readDescriptionTranslation(
  item: Pick<SubjectMaterialTopic | ExerciseMaterialGroup, "translations">,
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
