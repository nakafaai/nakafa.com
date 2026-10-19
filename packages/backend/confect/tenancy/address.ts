import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { SiteConfigError } from "@repo/backend/confect/site/spec";
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

/**
 * The address of a school's own host, such as `https://harapan.nakafa.com/`: the
 * school's label in front of the site's host name, with the site's protocol and
 * port. A local run answers `http://harapan.localhost:3000/`. The address is the
 * root of the host, whatever path the site URL carries. A site on an IP address
 * has no host to put a school label in front of, so the address fails as a site
 * configuration error instead of a defect.
 */
export const schoolAddress = Effect.fn("tenancy.address.school")(function* (
  siteUrl: URL,
  slug: TenantSlug
) {
  return yield* Effect.try({
    try: () => new URL(`${siteUrl.protocol}//${slug}.${siteUrl.host}/`).href,
    catch: () =>
      new SiteConfigError({
        code: "SITE_URL_INVALID",
        message:
          "SITE_URL must name a host, not an IP address, so that a school has its own host.",
      }),
  });
});
