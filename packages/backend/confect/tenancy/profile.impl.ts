import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantProfile } from "@repo/backend/confect/tenancy/profile";
import spec from "@repo/backend/confect/tenancy/profile.spec";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option } from "effect";

/**
 * The school at one address, in one unique indexed read, or none. An address that no
 * school uses answers none rather than failing, because every probe of a random School
 * host asks it, and a failure would log an error for each one.
 */
const readTenant = Effect.fn("tenancy.profile.readTenant")(function* (
  slug: TenantSlug
) {
  return yield* (yield* DatabaseReader)
    .table("tenants")
    .get("by_slug", slug)
    .pipe(
      Effect.asSome,
      Effect.catchTags({
        DocumentDecodeError: Effect.die,
        GetByIndexFailure: () => Effect.succeedNone,
      })
    );
});

/** The school's public identity and the logo's address when it has one; no identity, so a signed-out visitor sees the school's name. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.profile.get")(function* ({ slug }) {
    const tenant = yield* readTenant(slug);
    if (Option.isNone(tenant)) {
      return Option.none();
    }
    return Option.some(yield* tenantProfile(tenant.value));
  })
);

/**
 * Whether the Worker refuses a visitor's school page (ADR 0026): a school that no one
 * has the address of is refused. A request with a session never asks, because the
 * layout's gate reads the viewer in the browser and draws its refusal there.
 */
const refusal = FunctionImpl.make(
  databaseSchema,
  spec,
  "refusal",
  Effect.fn("tenancy.profile.refusal")(function* ({ slug }) {
    return Option.isNone(yield* readTenant(slug));
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(refusal),
  GroupImpl.finalize
);
