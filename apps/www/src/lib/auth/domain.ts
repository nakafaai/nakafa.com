import { MAIN_DOMAIN } from "@repo/site/domains";

/**
 * The domain a site's session cookies name, so every school host under it shares them: production's whole domain
 * (ADR 0026). Any other site, staging and the local runtime included, keeps its cookies to its own host, since a
 * single-label host such as `localhost` can name no domain a browser takes.
 */
export function sharedCookieDomain(site: URL) {
  return site.hostname === MAIN_DOMAIN ? MAIN_DOMAIN : undefined;
}
