import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { NewTenantSlug, TenantSlug } from "@repo/backend/confect/tenancy/slug";
import type { AddressState } from "@repo/backend/confect/tenancy/start";
import { Effect, Option, Schema } from "effect";

/**
 * Whether a label can name a new school: `invalid` when it is no slug, then
 * `reserved` when Nakafa keeps it, then `taken` when a school already holds it,
 * else `free`. Opening a school and the questionnaire's live check both ask
 * this, so the order of the answers has one owner.
 */
export const readAddress = Effect.fn("tenancy.address.read")(function* (
  label: string
) {
  if (!Schema.is(TenantSlug)(label)) {
    return "invalid" satisfies typeof AddressState.Type;
  }
  if (!Schema.is(NewTenantSlug)(label)) {
    return "reserved" satisfies typeof AddressState.Type;
  }
  const holder = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", label))
    .first()
    .pipe(Effect.orDie);
  return Option.isSome(holder)
    ? ("taken" satisfies typeof AddressState.Type)
    : ("free" satisfies typeof AddressState.Type);
});
