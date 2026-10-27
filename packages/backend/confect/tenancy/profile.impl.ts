import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { Session } from "@repo/backend/confect/auth/session";
import { resolveMember } from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { tenantProfile } from "@repo/backend/confect/tenancy/profile";
import spec from "@repo/backend/confect/tenancy/profile.spec";
import { Effect, Layer, Option } from "effect";

/**
 * One unique indexed read, and the logo's address when the school has one; no
 * identity, so a signed-out visitor sees the school's name. An address that no
 * school uses answers none rather than failing, because every probe of a random
 * School host asks it, and a failure would log an error for each one.
 */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.profile.get")(function* ({ slug }) {
    const tenant = yield* (yield* DatabaseReader)
      .table("tenants")
      .get("by_slug", slug)
      .pipe(
        Effect.asSome,
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIndexFailure: () => Effect.succeedNone,
        })
      );
    if (Option.isNone(tenant)) {
      return Option.none();
    }
    return Option.some(yield* tenantProfile(tenant.value));
  })
);

/**
 * Whether the proxy refuses a school page (ADR 0026), in one query. A school that
 * no one has the address of is refused for every caller. An existing school admits a
 * visitor, and a signed-in account the app cannot read, which the layout decides. A
 * signed-in account that is not a member admits too, because the layout shows it the
 * outsider page, and a member is refused when the school denies it the school's view.
 */
const refusal = FunctionImpl.make(
  databaseSchema,
  spec,
  "refusal",
  Effect.fn("tenancy.profile.refusal")(function* ({ slug }) {
    const tenant = yield* (yield* DatabaseReader)
      .table("tenants")
      .get("by_slug", slug)
      .pipe(
        Effect.asSome,
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIndexFailure: () => Effect.succeedNone,
        })
      );
    if (Option.isNone(tenant)) {
      return true;
    }
    const { authId, appUser } = yield* Session;
    if (
      authId === undefined ||
      appUser === null ||
      isAccountDeletionPending(appUser)
    ) {
      return false;
    }
    const principal = yield* resolveMember(tenant.value, appUser._id).pipe(
      Effect.asSome,
      Effect.catchTag("NotMember", () => Effect.succeedNone)
    );
    if (Option.isNone(principal)) {
      return false;
    }
    return yield* tenantAuthority.check("tenant.view", tenant.value).pipe(
      Effect.provideService(Member, principal.value),
      Effect.as(false),
      Effect.catchTag("AccessDenied", () => Effect.succeed(true))
    );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(refusal),
  Layer.provide(session),
  GroupImpl.finalize
);
