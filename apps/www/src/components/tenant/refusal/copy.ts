import { GrantRejected } from "@repo/backend/confect/access/errors";
import {
  type CohortHold,
  CohortInUse,
  type PeriodHold,
  PeriodInUse,
} from "@repo/backend/confect/tenancy/errors";
import type { ToastCopy } from "@repo/design-system/lib/toast/notify";
import { Option, Predicate, Record as Rec, Schema } from "effect";
import { REFUSAL_COPY } from "@/components/tenant/refusal/tags";

/** The copy of a write that failed with no refusal of its own, in the toast every School action uses. */
const ACTION_ERROR: ToastCopy = {
  description: "action-error.description",
  title: "action-error.title",
};

/** Each code that a refused grant names, which tells the grant refusals apart. */
type GrantCode = GrantRejected["code"];

/**
 * The copy of each code of a grant the tenant refuses. The grant refusal names several
 * refusals under one tag, so the code tells them apart. Every code has its copy, so the
 * lookup needs no fallback.
 */
const GRANT_REFUSAL_COPY: Readonly<Record<GrantCode, ToastCopy>> = {
  GRANT_LIMIT: {
    description: "school-refusal-grant-limit.description",
    title: "school-refusal-grant-limit.title",
  },
  GRANT_ROLE: {
    description: "school-refusal-grant-role.description",
    title: "school-refusal-grant-role.title",
  },
  GRANT_SCOPE: {
    description: "school-refusal-grant-scope.description",
    title: "school-refusal-grant-scope.title",
  },
  LAST_OWNER: {
    description: "school-refusal-last-owner.description",
    title: "school-refusal-last-owner.title",
  },
  PERSON_INACTIVE: {
    description: "school-refusal-person-inactive.description",
    title: "school-refusal-person-inactive.title",
  },
  PERSON_KIND: {
    description: "school-refusal-person-kind.description",
    title: "school-refusal-person-kind.title",
  },
  SEAT_LIMIT: {
    description: "school-refusal-seat-limit.description",
    title: "school-refusal-seat-limit.title",
  },
  TEMPORARY_ROLE: {
    description: "school-refusal-temporary-role.description",
    title: "school-refusal-temporary-role.title",
  },
};

/**
 * The copy of each record that keeps a cohort from being deleted, by what the refusal says holds it, so the person
 * reads what to clear first or that the cohort is archived instead.
 */
const COHORT_HOLD_COPY: Readonly<Record<typeof CohortHold.Type, ToastCopy>> = {
  classes: {
    description: "school-refusal-cohort-in-use-classes.description",
    title: "school-refusal-cohort-in-use-classes.title",
  },
  homeroom: {
    description: "school-refusal-cohort-in-use-homeroom.description",
    title: "school-refusal-cohort-in-use-homeroom.title",
  },
  letters: {
    description: "school-refusal-cohort-in-use-letters.description",
    title: "school-refusal-cohort-in-use-letters.title",
  },
  members: {
    description: "school-refusal-cohort-in-use-members.description",
    title: "school-refusal-cohort-in-use-members.title",
  },
  promotions: {
    description: "school-refusal-cohort-in-use-promotions.description",
    title: "school-refusal-cohort-in-use-promotions.title",
  },
  reports: {
    description: "school-refusal-cohort-in-use-reports.description",
    title: "school-refusal-cohort-in-use-reports.title",
  },
  sittings: {
    description: "school-refusal-cohort-in-use-sittings.description",
    title: "school-refusal-cohort-in-use-sittings.title",
  },
};

/** The copy of each reason a period cannot be deleted, by what the refusal says holds it. */
const PERIOD_HOLD_COPY: Readonly<Record<typeof PeriodHold.Type, ToastCopy>> = {
  active: {
    description: "school-refusal-period-in-use-active.description",
    title: "school-refusal-period-in-use-active.title",
  },
  classes: {
    description: "school-refusal-period-in-use-classes.description",
    title: "school-refusal-period-in-use-classes.title",
  },
  cohorts: {
    description: "school-refusal-period-in-use-cohorts.description",
    title: "school-refusal-period-in-use-cohorts.title",
  },
  grades: {
    description: "school-refusal-period-in-use-grades.description",
    title: "school-refusal-period-in-use-grades.title",
  },
  graduations: {
    description: "school-refusal-period-in-use-graduations.description",
    title: "school-refusal-period-in-use-graduations.title",
  },
  insight: {
    description: "school-refusal-period-in-use-insight.description",
    title: "school-refusal-period-in-use-insight.title",
  },
  promotions: {
    description: "school-refusal-period-in-use-promotions.description",
    title: "school-refusal-period-in-use-promotions.title",
  },
};

/**
 * The copy of a failed write of the school: a refused grant by its code, a record in use by what holds it, a typed
 * refusal by its tag, and the action error for a call that did not complete or a refusal no copy names.
 */
export function refusalCopy(error: unknown): ToastCopy {
  if (Schema.is(GrantRejected)(error)) {
    return GRANT_REFUSAL_COPY[error.code];
  }
  if (Schema.is(CohortInUse)(error)) {
    return COHORT_HOLD_COPY[error.holds];
  }
  if (Schema.is(PeriodInUse)(error)) {
    return PERIOD_HOLD_COPY[error.holds];
  }
  return Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag)
    ? Option.getOrElse(Rec.get(REFUSAL_COPY, error._tag), () => ACTION_ERROR)
    : ACTION_ERROR;
}
