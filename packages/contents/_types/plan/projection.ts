import type { ExercisesMaterialList } from "@repo/contents/_types/exercises/material";
import type {
  ExercisePlanGroup,
  ExercisePlanSource,
  PlanLocale,
  PlanSource,
  SubjectPlanSource,
  SubjectPlanTopic,
} from "@repo/contents/_types/plan/schema";
import type { MaterialList } from "@repo/contents/_types/subject/material";
import { cleanSlug } from "@repo/utilities/helper";

/** Sync-ready subject topic projected from the typed Plan source. */
export interface SubjectPlanTopicProjection {
  category: SubjectPlanSource["category"];
  description?: string;
  grade: SubjectPlanSource["grade"];
  locale: PlanLocale;
  material: SubjectPlanSource["material"];
  order: number;
  sections: SubjectPlanSectionProjection[];
  slug: string;
  title: string;
  topic: string;
}

/** Sync-ready subject section order projected from the typed Plan source. */
export interface SubjectPlanSectionProjection {
  order: number;
  section: string;
  slug: string;
}

/** Sync-ready exercise set projected from the typed Plan source. */
export interface ExercisePlanSetProjection {
  category: ExercisePlanSource["category"];
  description?: string;
  exerciseType: string;
  exerciseTypeTitle: string;
  locale: PlanLocale;
  material: ExercisePlanSource["material"];
  setName: string;
  slug: string;
  title: string;
  type: ExercisePlanSource["type"];
  year?: number;
}

/** Returns the localized subject navigation list expected by lesson pages. */
export function toSubjectMaterialList(
  plan: SubjectPlanSource,
  locale: PlanLocale
): MaterialList {
  return plan.topics.map((topic) => ({
    ...readDescriptionTranslation(topic, locale),
    href: `/${plan.baseRoute}/${topic.slug}`,
    items: topic.sections.map((section) => ({
      href: `/${plan.baseRoute}/${topic.slug}/${section.slug}`,
      title: section.translations[locale].title,
    })),
  }));
}

/** Returns the localized exercise navigation list expected by exercise pages. */
export function toExerciseMaterialList(
  plan: ExercisePlanSource,
  locale: PlanLocale
): ExercisesMaterialList {
  return plan.groups.map((group) => {
    const groupRoute = getExerciseGroupRoute(plan, group);

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

/** Projects all subject plan sources into sync-ready topic rows. */
export function listSubjectPlanTopics(
  plans: readonly PlanSource[],
  locale?: PlanLocale
) {
  return plans.flatMap((plan) => {
    if (plan.kind !== "subject") {
      return [];
    }

    const locales: PlanLocale[] =
      locale === undefined ? ["en", "id"] : [locale];

    return locales.flatMap((planLocale) =>
      plan.topics.map((topic, order) =>
        toSubjectPlanTopicProjection(plan, topic, planLocale, order)
      )
    );
  });
}

/** Projects all exercise plan sources into sync-ready set rows. */
export function listExercisePlanSets(
  plans: readonly PlanSource[],
  locale?: PlanLocale
) {
  return plans.flatMap((plan) => {
    if (plan.kind !== "exercise") {
      return [];
    }

    const locales: PlanLocale[] =
      locale === undefined ? ["en", "id"] : [locale];

    return locales.flatMap((planLocale) =>
      plan.groups.flatMap((group) =>
        group.sets.map((set) => {
          const groupRoute = getExerciseGroupRoute(plan, group);

          return {
            category: plan.category,
            description: group.translations[planLocale].description,
            exerciseType: group.exerciseType,
            exerciseTypeTitle: group.translations[planLocale].title,
            locale: planLocale,
            material: plan.material,
            setName: set.slug,
            slug: `${groupRoute}/${set.slug}`,
            title: set.translations[planLocale].title,
            type: plan.type,
            ...(group.year === undefined ? {} : { year: group.year }),
          };
        })
      )
    );
  });
}

/** Finds one plan whose base route matches the requested public route. */
export function findPlanByRoute(
  plans: readonly PlanSource[],
  kind: PlanSource["kind"],
  route: string
) {
  const normalizedRoute = normalizePlanRoute(route);

  return (
    plans.find((plan) => {
      if (plan.kind !== kind) {
        return false;
      }

      return (
        normalizedRoute === plan.baseRoute ||
        normalizedRoute.startsWith(`${plan.baseRoute}/`)
      );
    }) ?? null
  );
}

/** Normalizes a route so plans do not depend on leading slash differences. */
export function normalizePlanRoute(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
}

function toSubjectPlanTopicProjection(
  plan: SubjectPlanSource,
  topic: SubjectPlanTopic,
  locale: PlanLocale,
  order: number
): SubjectPlanTopicProjection {
  return {
    category: plan.category,
    description: topic.translations[locale].description,
    grade: plan.grade,
    locale,
    material: plan.material,
    order,
    sections: topic.sections.map((section, sectionOrder) => ({
      order: sectionOrder,
      section: section.slug,
      slug: `${plan.baseRoute}/${topic.slug}/${section.slug}`,
    })),
    slug: `${plan.baseRoute}/${topic.slug}`,
    title: topic.translations[locale].title,
    topic: topic.slug,
  };
}

function getExerciseGroupRoute(
  plan: ExercisePlanSource,
  group: ExercisePlanGroup
) {
  const segments = [plan.baseRoute, group.exerciseType];

  if (group.year !== undefined) {
    segments.push(String(group.year));
  }

  return segments.join("/");
}

function readDescriptionTranslation(
  item: Pick<SubjectPlanTopic | ExercisePlanGroup, "translations">,
  locale: PlanLocale
) {
  const translation = item.translations[locale];

  return {
    ...(translation.description === undefined
      ? {}
      : { description: translation.description }),
    title: translation.title,
  };
}
