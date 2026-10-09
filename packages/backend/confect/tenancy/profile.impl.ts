import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import spec from "@repo/backend/confect/tenancy/profile.spec";
import { tenantProfile } from "@repo/backend/confect/tenancy/schema";
import { Effect, Layer } from "effect";

/** One unique indexed read; no identity, so a signed-out visitor sees the school's name. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.profile.get")(function* ({ slug }) {
    return yield* (yield* DatabaseReader)
      .table("tenants")
      .get("by_slug", slug)
      .pipe(
        Effect.map(tenantProfile),
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIndexFailure: () => Effect.fail(TenantNotFound.make()),
        })
      );
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  GroupImpl.finalize
);
