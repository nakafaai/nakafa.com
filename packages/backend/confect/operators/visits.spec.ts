import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { VisitAccess } from "@repo/backend/confect/operators/access";
import {
  NotOperator,
  OperatorHasPerson,
  TenantSuspended,
  VisitNotApproved,
  VisitNotPending,
  VisitOpen,
} from "@repo/backend/confect/operators/errors";
import {
  VisitMinutes,
  VisitNote,
  VisitReason,
  VisitView,
} from "@repo/backend/confect/operators/schema";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The visits of Nakafa operators. An operator requests one, the school's Owner or
 * Admin approves or declines it, and the visit ends by hand or on its own term.
 * The school's list shows the requests it has not answered.
 */
export default GroupSpec.make()
  .middleware(Session)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "request",
      args: () => ({
        minutes: VisitMinutes,
        note: VisitNote,
        reason: VisitReason,
        tenantId: Id("tenants"),
      }),
      returns: () => VisitView,
      error: () =>
        Schema.Union([
          SessionRequired,
          AccountUnavailable,
          NotOperator,
          TenantNotFound,
          TenantSuspended,
          VisitOpen,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => VisitView,
      error: () => AccessDenied,
    })
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "visit.approve" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "approve",
      args: () => ({ slug: TenantSlug, visitId: Id("tenantVisits") }),
      returns: () => VisitView,
      error: () =>
        Schema.Union([
          AccessDenied,
          NotOperator,
          OperatorHasPerson,
          VisitNotPending,
        ]),
    })
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "visit.approve" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "decline",
      args: () => ({ slug: TenantSlug, visitId: Id("tenantVisits") }),
      returns: () => VisitView,
      error: () => Schema.Union([AccessDenied, VisitNotPending]),
    })
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "visit.approve" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "end",
      args: () => ({ slug: TenantSlug, visitId: Id("tenantVisits") }),
      returns: () => VisitView,
      error: () => Schema.Union([AccessDenied, VisitNotApproved]),
    })
      .middleware(RequireMember)
      .middleware(VisitAccess, { action: "visit.end", arg: "visitId" })
  );
