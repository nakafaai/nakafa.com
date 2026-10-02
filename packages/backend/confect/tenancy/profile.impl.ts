import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import spec from "@repo/backend/confect/tenancy/profile.spec";
import { Effect, Layer } from "effect";

/** One unique indexed read; no identity, so a signed-out visitor sees the school's name. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.profile.get")(function* ({ slug }) {
    const tenant = yield* (yield* DatabaseReader)
      .table("tenants")
      .get("by_slug", slug)
      .pipe(
        Effect.catchTags({
          DocumentDecodeError: Effect.die,
          GetByIndexFailure: () =>
            Effect.fail(
              new TenantNotFound({
                code: "TENANT_NOT_FOUND",
                message: "No school has this address.",
              })
            ),
        })
      );
    return {
      kind: tenant.kind,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  GroupImpl.finalize
);
