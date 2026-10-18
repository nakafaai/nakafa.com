import { SiteConfigError } from "@repo/backend/confect/site/spec";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect } from "effect";

/**
 * The address of a school's own host, such as `https://harapan.nakafa.com/`: the
 * school's label in front of the site's host name, with the site's protocol and
 * port. A local run answers `http://harapan.localhost:3000/`. The address is the
 * root of the host, whatever path the site URL carries. A site on an IP address
 * has no host to put a school label in front of, so the address fails as a site
 * configuration error instead of a defect.
 */
export const schoolAddress = Effect.fn("emails.invite.schoolAddress")(
  function* (siteUrl: URL, slug: TenantSlug) {
    return yield* Effect.try({
      try: () => new URL(`${siteUrl.protocol}//${slug}.${siteUrl.host}/`).href,
      catch: () =>
        new SiteConfigError({
          code: "SITE_URL_INVALID",
          message:
            "SITE_URL must name a host, not an IP address, so that a school has its own host.",
        }),
    });
  }
);
