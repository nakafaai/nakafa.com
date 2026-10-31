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

/**
 * The redirects of the nakafa.com zone, which answer before any Worker, with the
 * path and query kept, so every page has one address that search engines index
 * (ADR 0038, the zone rules it left open). The www host moves to the apex with a
 * 301. A plain-HTTP request on any host moves to HTTPS with a 308, which keeps
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
