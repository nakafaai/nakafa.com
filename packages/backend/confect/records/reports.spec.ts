import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { ReportAccess } from "@repo/backend/confect/records/access";
import {
  ReportClosed,
  ReportNotPlaced,
} from "@repo/backend/confect/records/errors";
import {
  ReportCohort,
  ReportDetail,
  ReportLine,
  ReportNote,
  ReportView,
} from "@repo/backend/confect/records/report";
import { CohortAccess } from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The report cards of a cohort (ADR 0033, S4). The homeroom teacher writes each placed
 * student's note and hands the report in, or takes it back while the principal has not
 * approved it; the principal approves it, which draws its PDF and locks it. The cohort's
 * list and each report open to the homeroom teacher, the principal, and the Admin.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "cohorts",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(ReportCohort),
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "sheet",
      args: () => ({ cohortId: Id("tenantCohorts"), slug: TenantSlug }),
      item: () => ReportLine,
      error: () => AccessDenied,
    }).middleware(CohortAccess, { action: "report.list", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ reportId: Id("reportCards"), slug: TenantSlug }),
      returns: () => ReportDetail,
      error: () => AccessDenied,
    }).middleware(ReportAccess, { action: "report.view", arg: "reportId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "write",
      args: () => ({
        cohortId: Id("tenantCohorts"),
        note: ReportNote,
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => ReportView,
      error: () => Schema.Union([AccessDenied, ReportClosed, ReportNotPlaced]),
    }).middleware(CohortAccess, { action: "report.write", arg: "cohortId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "complete",
      args: () => ({ reportId: Id("reportCards"), slug: TenantSlug }),
      returns: () => ReportView,
      error: () => Schema.Union([AccessDenied, ReportClosed]),
    }).middleware(ReportAccess, { action: "report.complete", arg: "reportId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reopen",
      args: () => ({ reportId: Id("reportCards"), slug: TenantSlug }),
      returns: () => ReportView,
      error: () => Schema.Union([AccessDenied, ReportClosed]),
    }).middleware(ReportAccess, { action: "report.complete", arg: "reportId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "approve",
      args: () => ({ reportId: Id("reportCards"), slug: TenantSlug }),
      returns: () => ReportView,
      error: () => Schema.Union([AccessDenied, ReportClosed]),
    }).middleware(ReportAccess, { action: "report.approve", arg: "reportId" })
  );
