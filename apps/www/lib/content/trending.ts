import { HttpClient } from "@confect/js";
import "@tanstack/react-start/server-only";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import contents from "@repo/backend/confect/_generated/refs/contents";
import { Effect } from "effect";
import { httpLayer } from "@/lib/convex/http";

/**
 * Reads one point-in-time homepage popularity snapshot.
 *
 * Trending is a low-freshness aggregate, so keeping one live subscription per
 * homepage visitor would amplify every popularity-counter update. Popularity
 * is live analytics rather than signed content, so it stays on the production
 * deployment while authored content builds from the isolated snapshot. The
 * ranking counts the last seven days and drops its oldest day once a night, so
 * a snapshot that is an hour old shows the same list for practical purposes:
 * the `hours` profile refreshes it at most once an hour, where the `minutes`
 * profile that it had refreshed it every minute and regenerated the page that
 * shows it each time. The Native Confect reads disable trace timestamps until
 * the network suspends, because Cache Components reject implicit clock access
 * during prerendering.
 *
 * @see https://nextjs.org/docs/messages/next-prerender-current-time
 * @see https://confect.dev/v10/clients/js/http
 */
export async function getHomeTrendingSubjects(locale: ActiveAppLocaleCode) {
  return await Effect.runPromise(
    Effect.flatMap(HttpClient.HttpClient, (client) =>
      client.query(contents.queries.trending.getTrendingSubjects, {
        locale,
      })
    ).pipe(Effect.provide(httpLayer()), Effect.withTracerTiming(false))
  );
}
