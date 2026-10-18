import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  CohortAccess,
  PeriodAccess,
} from "@repo/backend/confect/tenancy/access";
import {
  CohortGrade,
  CohortName,
  CohortStatus,
} from "@repo/backend/confect/tenancy/cohort";
import {
  CohortLimit,
  CohortNameTaken,
} from "@repo/backend/confect/tenancy/errors";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One cohort as the wire shows it. */
const CohortView = Schema.Struct({
  grade: CohortGrade,
  id: Id("tenantCohorts"),
  name: CohortName,
  status: CohortStatus,
});

/** One Person placed in a cohort, as the cohort's members list shows them. */
const PlacedPersonView = Schema.Struct({
  id: Id("tenantPeople"),
  name: PersonName,
});

/**
 * The cohorts of one period. The school's Admin creates, renames, and archives
 * them, and the roles that read the plan read them. A Person placed in a cohort
 * reads its members, because the `cohortMember` relation opens `cohort.view`.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
      returns: () => Schema.Array(CohortView),
      error: () => AccessDenied,
    }).middleware(PeriodAccess, { action: "period.view", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "activePeriod",
      args: () => ({ slug: TenantSlug, unitId: Id("tenantUnits") }),
      returns: () => Schema.NullOr(Id("tenantPeriods")),
      error: () => AccessDenied,
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "members",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      item: () => PlacedPersonView,
      error: () => AccessDenied,
    }).middleware(CohortAccess, { action: "cohort.view", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        grade: CohortGrade,
        name: CohortName,
        periodId: Id("tenantPeriods"),
        slug: TenantSlug,
      }),
      returns: () => CohortView,
      error: () => Schema.Union([AccessDenied, CohortLimit, CohortNameTaken]),
    }).middleware(PeriodAccess, { action: "cohort.manage", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        name: CohortName,
        slug: TenantSlug,
      }),
      returns: () => CohortView,
      error: () => Schema.Union([AccessDenied, CohortNameTaken]),
    }).middleware(CohortAccess, { action: "cohort.manage", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archive",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      returns: () => CohortView,
      error: () => AccessDenied,
    }).middleware(CohortAccess, { action: "cohort.manage", arg: "cohortId" })
  );
