import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { GuardianLinkAccess } from "@repo/backend/confect/guardians/access";
import {
  RequestDecision,
  RequestKind,
  RequestText,
  RequestView,
  WaitingRequest,
} from "@repo/backend/confect/guardians/request";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * What parents ask the school office (ADR 0034): a parent with a verified link asks for a copy of a report or a
 * correction of the child's data, and Staff approves or declines each one.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "ask",
      args: () => ({
        kind: RequestKind,
        linkId: Id("guardianLinks"),
        slug: TenantSlug,
        text: RequestText,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.request",
      arg: "linkId",
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "ofLink",
      args: () => ({ linkId: Id("guardianLinks"), slug: TenantSlug }),
      returns: () => Schema.Array(RequestView),
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.child",
      arg: "linkId",
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "waiting",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Array(WaitingRequest),
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "guardian.list" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "answer",
      args: () => ({
        decision: RequestDecision,
        linkId: Id("guardianLinks"),
        requestId: Id("guardianRequests"),
        slug: TenantSlug,
      }),
      returns: () => Schema.Null,
      error: () => AccessDenied,
    }).middleware(GuardianLinkAccess, {
      action: "guardian.answer",
      arg: "linkId",
    })
  );
