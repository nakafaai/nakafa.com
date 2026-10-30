import { Ruleset, type Zone } from "@alchemy.run/cloudflare";
import { Effect } from "effect";
import { NAKAFA_ZONE } from "#www/deploy/stage";

/**
 * The redirects of the nakafa.com zone, which answer before any Worker: the www
 * host moves to the apex, and a plain-HTTP request on any host moves to HTTPS,
 * both with 301 and the path and query kept, so every page has one address that
 * search engines index (ADR 0038, the zone rules it left open).
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
