import type { MiddlewareSpec } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import type {
  TenantsDoc,
  UsersDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { requireAuth } from "@repo/backend/confect/auth/session";
import RequireMember, {
  Member,
  NotMember,
} from "@repo/backend/confect/middleware/member.spec";
import { isActiveOperator } from "@repo/backend/confect/operators/staff";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";

/** Every tenant function declares `slug`; its absence is a wiring defect. */
const SlugArgs = Schema.Struct({ slug: TenantSlug });

/**
 * The caller's active Person in a tenant, with the Person's active grants, which
 * every access check of an execution reuses. A caller without an active Person,
 * and an operator whose operator access was revoked, get `NotMember`: the grants
 * of such a visit stop at once, whatever their term.
 */
export const resolveMember = Effect.fn("tenancy.member.resolve")(function* (
  tenant: TenantsDoc,
  userId: UsersDoc["_id"]
) {
  const reader = yield* DatabaseReader;
  const person = yield* reader
    .table("tenantPeople")
    .get("by_tenantId_and_account_userId", tenant._id, userId)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIndexFailure: () => Effect.fail(new NotMember()),
      }),
      Effect.filterOrFail(
        (caller) => caller.status === "active",
        () => new NotMember()
      )
    );
  if (person.kind === "operator" && !(yield* isActiveOperator(userId))) {
    return yield* new NotMember();
  }
  return {
    grants: yield* activeGrants(person._id),
    person,
    tenant,
  };
});

/**
 * Three indexed reads: the tenant by slug, the caller's Person in it, then the
 * Person's active grants, which every access check of the execution reuses.
 * An unknown slug gets the same `NotMember` as a caller without a Person.
 */
export const member = Effect.fn("tenancy.member")(function* <E>(
  effect: Effect.Effect<MiddlewareSpec.SuccessValue, E, Member>,
  { invocation }: MiddlewareSpec.MiddlewareOptions
) {
  const { appUser } = yield* requireAuth();
  const { slug } = yield* Schema.decodeUnknownEffect(SlugArgs)(
    invocation.args
  ).pipe(Effect.orDie);
  const reader = yield* DatabaseReader;
  const tenant = yield* reader
    .table("tenants")
    .get("by_slug", slug)
    .pipe(
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIndexFailure: () => Effect.fail(new NotMember()),
      })
    );
  return yield* effect.pipe(
    Effect.provideService(Member, yield* resolveMember(tenant, appUser._id))
  );
});

export default MiddlewareImpl.make(databaseSchema, RequireMember, member);
