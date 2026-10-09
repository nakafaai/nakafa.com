import { MiddlewareSpec } from "@confect/core";
import tenantGrants from "@repo/backend/confect/_generated/tables/tenantGrants";
import tenantPeople from "@repo/backend/confect/_generated/tables/tenantPeople";
import tenants from "@repo/backend/confect/_generated/tables/tenants";
import type { Session } from "@repo/backend/confect/auth/session";
import {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import { Context, Effect, Schema } from "effect";

/**
 * The tenant named by the route slug, the caller's active Person in it, and
 * the Person's active grants. Loaded once per execution, it is the principal
 * every access check of that execution decides on.
 */
const Principal = Schema.Struct({
  grants: Schema.Array(tenantGrants.Doc),
  person: tenantPeople.Doc,
  tenant: tenants.Doc,
});

export class Member extends Context.Service<Member, typeof Principal.Type>()(
  "@repo/backend/confect/middleware/member.spec/Member"
) {}

const notMember = Schema.Literal("NOT_MEMBER");

/**
 * The caller has no active Person in the tenant, or the tenant does not
 * exist. One answer for both, so a slug probe reveals nothing.
 */
export class NotMember extends Schema.TaggedError<NotMember>()("NotMember", {
  code: notMember.pipe(
    Schema.withConstructorDefault(Effect.succeed(notMember.literal))
  ),
  message: Schema.String.pipe(
    Schema.withConstructorDefault(
      Effect.succeed("You are not a member of this school.")
    )
  ),
}) {}

/** Resolves the tenant from the function's `slug` argument and the caller's Person in it. */
export default class RequireMember extends MiddlewareSpec.MiddlewareSpec<
  RequireMember,
  { provides: Member; requires: Session }
>()("Member", {
  error: () => Schema.Union([SessionRequired, AccountUnavailable, NotMember]),
  functionTypes: { action: false, mutation: true, query: true },
}) {}
