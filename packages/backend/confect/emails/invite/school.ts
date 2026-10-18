import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";

/**
 * The address of a school's own host, such as `https://harapan.nakafa.com/`: the
 * school's label in front of the site's host name, with the site's protocol and
 * port. A local run answers `http://harapan.localhost:3000/`. The address is the
 * root of the host, whatever path the site URL carries.
 */
export function schoolAddress(siteUrl: URL, slug: TenantSlug): string {
  return new URL(`${siteUrl.protocol}//${slug}.${siteUrl.host}/`).href;
}
