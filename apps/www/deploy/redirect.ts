import { Ruleset, type Zone } from "@alchemy.run/cloudflare";
import { LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr, Effect } from "effect";
import { NAKAFA_ZONE } from "#www/deploy/stage";

/** A path under one of the locales, where every static page lives. */
const LOCALE_PATH_EXPRESSION = Arr.join(
  Arr.map(
    LOCALES,
    (locale) => `starts_with(http.request.uri.path, "/${locale}/")`
  ),
  " or "
);

/** A locale's own root, such as `/id`, the one page path that does not continue past the locale. */
const LOCALE_ROOT_EXPRESSION = `http.request.uri.path in {${Arr.join(
  Arr.map(LOCALES, (locale) => `"/${locale}"`),
  " "
)}}`;

/**
 * The hosts under the zone that serve their own Worker and answer their own
 * paths: staging is the whole site behind Access, and the API, MCP and CAS hosts
 * have exact Worker routes (`deploy/stage.ts`). Every other subdomain is a school
 * host or names nothing.
 */
const OWN_HOSTS = Arr.map(
  ["staging", "api", "mcp", "cas"],
  (label) => `"${label}.${NAKAFA_ZONE}"`
);

/**
 * A page of the main site asked on another subdomain: a locale path on a host
 * under the zone that is neither the apex nor one of the hosts with their own
 * Worker. Cloudflare serves a static asset before any Worker on every host the
 * wildcard routes, so without this rule `<anything>.nakafa.com/id` would answer
 * the main site's page with 200, a copy on every invented host. A school host's
 * own pages carry no locale in their path, so the rule never touches them.
 */
const MAIN_PAGE_ON_SUBDOMAIN_EXPRESSION = `http.host ne "${NAKAFA_ZONE}" and ends_with(http.host, ".${NAKAFA_ZONE}") and not http.host in {${Arr.join(OWN_HOSTS, " ")}} and (${LOCALE_ROOT_EXPRESSION} or ${LOCALE_PATH_EXPRESSION})`;

/**
 * The redirects of the nakafa.com zone, which answer before any Worker, with the
 * path and query kept, so every page has one address that search engines index
 * (ADR 0038, the zone rules it left open). The www host moves to the apex with a
 * 301, and so does a main site page that another subdomain answers. A plain-HTTP request on any host moves to HTTPS with a 308, which keeps
 * the method and body, so a POST to an API, MCP or CAS host over HTTP arrives as
 * the same POST. A page address with a trailing slash moves to the address
 * without it with a 308, as the Worker answers every other path, because the
 * static assets answer it with a 307 before the Worker runs.
 */
export const deployNakafaRedirects = Effect.fn("deploy.nakafaRedirects")(
  function* (zone: Zone.Zone) {
    // The Ruleset owns the zone's whole dynamic redirect phase, which held no
    // rule before it, as the nakafa.id redirect owns that zone's phase.
    yield* Ruleset.Ruleset("NakafaRedirects", {
      zone,
      phase: "http_request_dynamic_redirect",
      rules: [
        {
          action: "redirect",
          actionParameters: {
            fromValue: {
              preserveQueryString: true,
              statusCode: 301,
              targetUrl: {
                expression: `concat("https://${NAKAFA_ZONE}", http.request.uri.path)`,
              },
            },
          },
          description: "www to the apex",
          enabled: true,
          expression: `http.host eq "www.${NAKAFA_ZONE}"`,
        },
        {
          action: "redirect",
          actionParameters: {
            fromValue: {
              preserveQueryString: true,
              statusCode: 301,
              targetUrl: {
                expression: `concat("https://${NAKAFA_ZONE}", http.request.uri.path)`,
              },
            },
          },
          description: "A main site page on another subdomain to the apex",
          enabled: true,
          expression: MAIN_PAGE_ON_SUBDOMAIN_EXPRESSION,
        },
        {
          action: "redirect",
          actionParameters: {
            fromValue: {
              preserveQueryString: true,
              statusCode: 308,
              targetUrl: {
                expression:
                  'concat("https://", http.host, http.request.uri.path)',
              },
            },
          },
          description: "HTTP to HTTPS",
          enabled: true,
          expression: "not ssl",
        },
        {
          action: "redirect",
          actionParameters: {
            fromValue: {
              preserveQueryString: true,
              statusCode: 308,
              targetUrl: {
                expression: `concat("https://${NAKAFA_ZONE}", wildcard_replace(http.request.uri.path, "/*/", "/\${1}"))`,
              },
            },
          },
          description: "A page's trailing slash",
          enabled: true,
          expression: `http.host eq "${NAKAFA_ZONE}" and ends_with(http.request.uri.path, "/") and (${LOCALE_PATH_EXPRESSION})`,
        },
      ],
    });
  }
);
