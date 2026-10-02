import type { MiddlewareSpec } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { requireAuth, type Session } from "@repo/backend/confect/auth/session";
import type {
  AccountUnavailable,
  SessionRequired,
} from "@repo/backend/confect/auth/spec";
import RequireMember, {
  Member,
  NotMember,
} from "@repo/backend/confect/middleware/member.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Option, Schema } from "effect";

/** Every tenant function declares `slug`; its absence is a wiring defect. */
const SlugArgs = Schema.Struct({ slug: TenantSlug });

const notMember = () =>
  new NotMember({
    code: "NOT_MEMBER",
    message: "You are not a member of this school.",
  });

/**
 * Three indexed reads: the tenant by slug, the caller's Person in it, then the
 * Person's active grants, which every access check of the execution reuses.
 */
export const member = Effect.fn("tenancy.member")(function* <E>(
  effect: Effect.Effect<MiddlewareSpec.SuccessValue, E, Member>,
  { invocation }: { readonly invocation: { readonly args: unknown } }
): Effect.fn.Return<
  MiddlewareSpec.SuccessValue,
  E | AccountUnavailable | NotMember | SessionRequired,
  DatabaseReader | Session
> {
  const { appUser } = yield* requireAuth();
  const { slug } = yield* Schema.decodeUnknownEffect(SlugArgs)(
    invocation.args
  ).pipe(Effect.orDie);
  const reader = yield* DatabaseReader;
  const tenant = yield* reader
    .table("tenants")
    .get("by_slug", slug)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isNone(tenant)) {
    return yield* notMember();
  }
  const person = yield* reader
    .table("tenantPeople")
    .get("by_tenantId_and_account_userId", tenant.value._id, appUser._id)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isNone(person) || person.value.status !== "active") {
    return yield* notMember();
  }
  return yield* effect.pipe(
    Effect.provideService(Member, {
      grants: yield* activeGrants(person.value._id),
      person: person.value,
      tenant: tenant.value,
    })
  );
});

export default MiddlewareImpl.make(databaseSchema, RequireMember, member);
