import type { MiddlewareSpec } from "@confect/core";
import { MiddlewareImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { requireAuth } from "@repo/backend/confect/auth/session";
import RequireMember, {
  Member,
  NotMember,
} from "@repo/backend/confect/middleware/member.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";

/** Every tenant function declares `slug`; its absence is a wiring defect. */
const SlugArgs = Schema.Struct({ slug: TenantSlug });

/**
 * Three indexed reads: the tenant by slug, the caller's Person in it, then the
 * Person's active grants, which every access check of the execution reuses.
 * An unknown slug, a caller without a Person, and an inactive Person get the
 * same `NotMember`.
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
  const { person, tenant } = yield* reader
    .table("tenants")
    .get("by_slug", slug)
    .pipe(
      Effect.flatMap((found) =>
        reader
          .table("tenantPeople")
          .get("by_tenantId_and_account_userId", found._id, appUser._id)
          .pipe(Effect.map((caller) => ({ person: caller, tenant: found })))
      ),
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIndexFailure: () => Effect.fail(NotMember.make()),
      }),
      Effect.filterOrFail(
        (found) => found.person.status === "active",
        () => NotMember.make()
      )
    );
  return yield* effect.pipe(
    Effect.provideService(Member, {
      grants: yield* activeGrants(person._id),
      person,
      tenant,
    })
  );
});

export default MiddlewareImpl.make(databaseSchema, RequireMember, member);
