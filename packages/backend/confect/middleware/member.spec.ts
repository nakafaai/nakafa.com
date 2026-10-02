import { MiddlewareSpec } from "@confect/core";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
  TenantsDoc,
} from "@repo/backend/confect/_generated/docs";
import type { Session } from "@repo/backend/confect/auth/session";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { Context, Schema } from "effect";

/**
 * The tenant named by the route slug, the caller's active Person in it, and
 * the Person's active grants. Loaded once per execution, it is the principal
 * every access check of that execution decides on.
 */
export class Member extends Context.Service<
  Member,
  {
    readonly grants: readonly TenantGrantsDoc[];
    readonly person: TenantPeopleDoc;
    readonly tenant: TenantsDoc;
  }
>()("@repo/backend/tenancy/Member") {}

/**
 * The caller has no active Person in the tenant, or the tenant does not
 * exist. One answer for both, so a slug probe reveals nothing.
 */
export class NotMember extends Schema.TaggedError<NotMember>()("NotMember", {
  code: Schema.Literal("NOT_MEMBER"),
  message: Schema.String,
}) {}

/** Resolves the tenant from the function's `slug` argument and the caller's Person in it. */
export default class RequireMember extends MiddlewareSpec.MiddlewareSpec<
  RequireMember,
  { provides: Member; requires: Session }
>()("Member", {
  error: () => Schema.Union([SessionRequired, AccountUnavailable, NotMember]),
  functionTypes: { action: false, mutation: true, query: true },
}) {}
