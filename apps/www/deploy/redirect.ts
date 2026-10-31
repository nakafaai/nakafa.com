import { Ruleset, type Zone } from "@alchemy.run/cloudflare";
import { Effect } from "effect";
import { NAKAFA_ZONE } from "#www/deploy/stage";

/**
 * The redirects of the nakafa.com zone, which answer before any Worker, with the
 * path and query kept, so every page has one address that search engines index
 * (ADR 0038, the zone rules it left open). The www host moves to the apex with a
 * 301. A plain-HTTP request on any host moves to HTTPS with a 308, which keeps
 * the method and body, so a POST to an API, MCP or CAS host over HTTP arrives as
 * the same POST.
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
      ],
    });
  }
);
