import type { TenantsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Effect, Option } from "effect";

/** The value of a lookup that must find one row. A missing row ends the seed with a defect that names it. */
export const required = <A>(lookup: Option.Option<A>, missing: string) =>
  Option.match(lookup, {
    onNone: () => Effect.die(missing),
    onSome: Effect.succeed,
  });

/** The school with the slug. */
export const tenantOf = Effect.fn("acceptance.lookup.tenant")(function* (
  slug: string
) {
  const found = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", slug))
    .first()
    .pipe(Effect.orDie);
  return yield* required(found, "No school has this slug.");
});

/** The first active unit of the school, which the seeded grants and sittings use. */
export const firstActiveUnit = Effect.fn("acceptance.lookup.unit")(function* (
  tenantId: TenantsDoc["_id"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .index("by_tenantId_and_status", (query) =>
      query.eq("tenantId", tenantId).eq("status", "active")
    )
    .first()
    .pipe(Effect.orDie);
  return yield* required(found, "The school has no active unit.");
});
