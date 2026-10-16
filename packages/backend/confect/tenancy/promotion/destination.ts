import type { TenantCohortsDoc } from "@repo/backend/confect/_generated/docs";
import { cohortNameKey } from "@repo/backend/confect/tenancy/cohort";
import type { PromotionPlanIssue } from "@repo/backend/confect/tenancy/errors";
import {
  type PromotionCreated,
  PromotionDestination,
  type PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion/schema";
import type { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option } from "effect";

/**
 * The last grade of each unit level: the grade whose students graduate. SD and MI
 * end at grade 6, SMP and MTs at 9, and SMA, MA, and SMK at 12. Levels without a
 * last grade, such as PAUD, SLB, and other, have none, so their students cannot
 * graduate through a promotion.
 */
const LAST_GRADE: Record<typeof UnitLevel.Type, number | undefined> = {
  ma: 12,
  mi: 6,
  mts: 9,
  other: undefined,
  paud: undefined,
  sd: 6,
  sma: 12,
  smk: 12,
  smp: 9,
  slb: undefined,
};

/** The last grade of a unit level, if its students can graduate. */
export const lastGradeOf = (level: typeof UnitLevel.Type) =>
  Option.fromUndefinedOr(LAST_GRADE[level]);

/**
 * Why a destination does not fit a cohort of the source period, if it does not.
 * A cohort destination needs a target of that name, `stay` needs a target with
 * the cohort's own name and grade, and graduation needs the cohort's grade to be
 * the last grade of its unit.
 */
export const destinationIssue = (
  targets: readonly (typeof PromotionTarget.Type)[],
  cohort: Pick<TenantCohortsDoc, "grade" | "name">,
  to: typeof PromotionDestination.Type,
  lastGrade: Option.Option<number>
): Option.Option<typeof PromotionPlanIssue.Type> => {
  const issue = (reason: typeof PromotionPlanIssue.Type) => Option.some(reason);
  const none = Option.none<typeof PromotionPlanIssue.Type>();
  return PromotionDestination.match(to, {
    cohort: ({ name }) =>
      Arr.some(
        targets,
        (target) => cohortNameKey(target.name) === cohortNameKey(name)
      )
        ? none
        : issue("destination"),
    graduate: () =>
      Option.exists(lastGrade, (grade) => grade === cohort.grade)
        ? none
        : issue("graduate"),
    stay: () =>
      Arr.some(
        targets,
        (target) =>
          cohortNameKey(target.name) === cohortNameKey(cohort.name) &&
          target.grade === cohort.grade
      )
        ? none
        : issue("stay"),
  });
};

/**
 * The name of the new cohort that a destination puts a student of a source cohort
 * in, if it puts them in one. A `stay` destination names the cohort's own name, and
 * graduation puts no one in a cohort, so it has no name.
 */
export const targetNameOf = (
  to: typeof PromotionDestination.Type,
  sourceName: string
): Option.Option<string> =>
  PromotionDestination.match(to, {
    cohort: ({ name }) => Option.some(name),
    graduate: () => Option.none(),
    stay: () => Option.some(sourceName),
  });

/** The cohort that applying the promotion created under a name, if it created one. */
export const createdCohort = (
  created: readonly (typeof PromotionCreated.Type)[],
  name: string
) =>
  Option.map(
    Arr.findFirst(created, (cohort) => cohort.nameKey === cohortNameKey(name)),
    (cohort) => cohort.cohortId
  );
