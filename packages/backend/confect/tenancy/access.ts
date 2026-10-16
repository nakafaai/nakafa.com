import { MiddlewareSpec } from "@confect/core";
import type {
  TenantCohortsDoc,
  TenantPeopleDoc,
  TenantPeriodsDoc,
} from "@repo/backend/confect/_generated/docs";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { Context } from "effect";

/** The Person that the function's `PersonAccess` check loaded and allowed. */
export class Person extends Context.Service<Person, TenantPeopleDoc>()(
  "@repo/backend/confect/tenancy/access/Person"
) {}

/** Checks a person action on the Person whose ID the `arg` argument holds. */
export class PersonAccess extends MiddlewareSpec.MiddlewareSpec<
  PersonAccess,
  { provides: Person; requires: Member }
>()("PersonAccess", Kind.middleware(entries, "person")) {}

/** The period that the function's `PeriodAccess` check loaded and allowed. */
export class Period extends Context.Service<Period, TenantPeriodsDoc>()(
  "@repo/backend/confect/tenancy/access/Period"
) {}

/** Checks a period action on the period whose ID the `arg` argument holds. */
export class PeriodAccess extends MiddlewareSpec.MiddlewareSpec<
  PeriodAccess,
  { provides: Period; requires: Member }
>()("PeriodAccess", Kind.middleware(entries, "period")) {}

/** The cohort that the function's `CohortAccess` check loaded and allowed. */
export class Cohort extends Context.Service<Cohort, TenantCohortsDoc>()(
  "@repo/backend/confect/tenancy/access/Cohort"
) {}

/** Checks a cohort action on the cohort whose ID the `arg` argument holds. */
export class CohortAccess extends MiddlewareSpec.MiddlewareSpec<
  CohortAccess,
  { provides: Cohort; requires: Member }
>()("CohortAccess", Kind.middleware(entries, "cohort")) {}
