import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  GraduationDateInvalid,
  GraduationIssued,
  GraduationNotFinal,
  GraduationUndecided,
} from "@repo/backend/confect/records/errors";
import {
  GraduationCohort,
  GraduationDecision,
  GraduationOverview,
  GraduationView,
} from "@repo/backend/confect/records/graduation";
import {
  GraduationLine,
  IssueResult,
  ReadinessRow,
} from "@repo/backend/confect/records/letter";
import {
  CohortAccess,
  PeriodAccess,
} from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The graduation of a unit's last grade (ADR 0033, S6). The principal records the head's
 * decision on graduation for the unit's period and issues each graduating student's SKL from
 * their class group, which draws its PDF and locks it. The principal, the Admin, and Staff open
 * the class groups, each student's transcript data and SKL, and the e-Ijazah readiness rows.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "cohorts",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(GraduationCohort),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      returns: () => GraduationOverview,
      error: () => Schema.Union([AccessDenied, GraduationNotFinal]),
    }).middleware(CohortAccess, { action: "graduation.view", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "sheet",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      item: () => GraduationLine,
      error: () => Schema.Union([AccessDenied, GraduationNotFinal]),
    }).middleware(CohortAccess, { action: "graduation.view", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "readiness",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      item: () => ReadinessRow,
      error: () => Schema.Union([AccessDenied, GraduationNotFinal]),
    }).middleware(CohortAccess, { action: "graduation.view", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "decide",
      args: () => ({
        ...GraduationDecision.fields,
        periodId: Id("tenantPeriods"),
        slug: TenantSlug,
      }),
      returns: () => GraduationView,
      error: () =>
        Schema.Union([
          AccessDenied,
          GraduationDateInvalid,
          GraduationIssued,
          GraduationNotFinal,
        ]),
    }).middleware(PeriodAccess, {
      action: "graduation.decide",
      arg: "periodId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "issue",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        cursor: Schema.NullOr(Schema.String),
        slug: TenantSlug,
      }),
      returns: () => IssueResult,
      error: () =>
        Schema.Union([AccessDenied, GraduationNotFinal, GraduationUndecided]),
    }).middleware(CohortAccess, { action: "graduation.issue", arg: "cohortId" })
  );
