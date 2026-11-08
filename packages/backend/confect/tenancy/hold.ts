import type {
  TenantCohortsDoc,
  TenantPeriodsDoc,
} from "@repo/backend/confect/_generated/docs";
import type { TableNames } from "@repo/backend/confect/_generated/id";
import type { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  CohortHold,
  PeriodHold,
} from "@repo/backend/confect/tenancy/errors";
import type { Effect } from "effect";

/** One field that points at a cohort or a period: its table, a dot, and its path in the row, where `[]` steps into an array. */
export type Reference = `${TableNames}.${string}`;

/**
 * One kind of record that keeps a cohort or a period in use. A domain that stores a reference declares it here: the
 * fields it points through, the hold a refused delete names, and the read that finds whether one row still points at
 * the subject. `tenancy/write/holds.ts` registers every holder, and its test fails on a reference no holder declares.
 */
export interface Holder<Subject, Hold> {
  readonly hold: Hold;
  readonly holds: (
    subject: Subject
  ) => Effect.Effect<boolean, never, DatabaseReader>;
  readonly references: readonly Reference[];
}

/** A record that keeps a cohort in use. A promotion reads the cohort's period, so the holder sees both. */
export type CohortHolder = Holder<
  Pick<TenantCohortsDoc, "_id" | "periodId">,
  typeof CohortHold.Type
>;

/** A record that keeps a period in use. */
export type PeriodHolder = Holder<
  Pick<TenantPeriodsDoc, "_id">,
  typeof PeriodHold.Type
>;
