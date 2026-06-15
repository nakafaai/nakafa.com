import {
  findPlanByRoute,
  listExercisePlanSets,
  listSubjectPlanTopics,
  toExerciseMaterialList,
  toSubjectMaterialList,
} from "@repo/contents/_types/plan/projection";
import type {
  ExercisePlanSource,
  PlanLocale,
  PlanSource,
  SubjectPlanSource,
} from "@repo/contents/_types/plan/schema";
import { PLAN_SOURCES } from "@repo/contents/_types/plan/source";

/** Returns all typed pedagogical plans owned by the source registry. */
export function listPlans(plans: readonly PlanSource[] = PLAN_SOURCES) {
  return plans;
}

/** Finds the subject plan that owns one public route. */
export function findSubjectPlan(
  route: string,
  plans: readonly PlanSource[] = PLAN_SOURCES
) {
  const plan = findPlanByRoute(plans, "subject", route);

  return plan?.kind === "subject" ? plan : null;
}

/** Finds the exercise plan that owns one public route. */
export function findExercisePlan(
  route: string,
  plans: readonly PlanSource[] = PLAN_SOURCES
) {
  const plan = findPlanByRoute(plans, "exercise", route);

  return plan?.kind === "exercise" ? plan : null;
}

/** Projects one route-owned subject plan into localized navigation rows. */
export function getSubjectMaterialList(
  route: string,
  locale: PlanLocale,
  plans: readonly PlanSource[] = PLAN_SOURCES
) {
  const plan = findSubjectPlan(route, plans);

  if (!plan) {
    return [];
  }

  return toSubjectMaterialList(plan, locale);
}

/** Projects one route-owned exercise plan into localized navigation rows. */
export function getExerciseMaterialList(
  route: string,
  locale: PlanLocale,
  plans: readonly PlanSource[] = PLAN_SOURCES
) {
  const plan = findExercisePlan(route, plans);

  if (!plan) {
    return [];
  }

  return toExerciseMaterialList(plan, locale);
}

/** Lists subject plans without exposing unrelated exercise plans to callers. */
export function listSubjectPlans(
  plans: readonly PlanSource[] = PLAN_SOURCES
): SubjectPlanSource[] {
  return plans.filter((plan) => plan.kind === "subject");
}

/** Lists exercise plans without exposing unrelated subject plans to callers. */
export function listExercisePlans(
  plans: readonly PlanSource[] = PLAN_SOURCES
): ExercisePlanSource[] {
  return plans.filter((plan) => plan.kind === "exercise");
}

/** Lists sync-ready subject topic projections for the requested content locale. */
export function listSubjectTopics(locale?: PlanLocale) {
  return listSubjectPlanTopics(PLAN_SOURCES, locale);
}

/** Lists sync-ready exercise set projections for the requested content locale. */
export function listExerciseSets(locale?: PlanLocale) {
  return listExercisePlanSets(PLAN_SOURCES, locale);
}
