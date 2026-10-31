import { env } from "cloudflare:workers";
import type { Locale } from "@repo/internationalization/src/locale";
import { Effect } from "effect";
import { withContentLanguage } from "@/lib/routing/not-found";
import { readsSchoolShell } from "@/lib/routing/school/shell.server";
import { schoolNotFoundPath } from "@/lib/static/notfound";

/**
 * Answers a refused page of a school host with the release's static not-found
 * page of the locale, made for a school host, and any other request with
 * `otherwise` (ADR 0026). The first HTML holds the page, so nothing paints blank,
 * and no Worker renders it, which matters because a scanner may try any address
 * under the School wildcard. Its home link leads to the main site, because the
 * school's own home is not found too. A school that does not exist and a school
 * that refuses the visitor answer the same, so the answer never tells which.
 */
export const answerSchoolRefusal = Effect.fn("www.routing.school.refused")(
  function* <A, E, R>(
    request: Request,
    locale: Locale,
    otherwise: Effect.Effect<A, E, R>
  ) {
    if (!readsSchoolShell(request)) {
      return yield* otherwise;
    }
    const page = yield* Effect.promise(() =>
      env.ASSETS.fetch(
        new Request(new URL(schoolNotFoundPath(locale), request.url))
      )
    );
    const headers = new Headers(page.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("Content-Type", "text/html; charset=utf-8");
    return withContentLanguage(
      new Response(request.method === "HEAD" ? null : page.body, {
        headers,
        status: 404,
      }),
      locale
    );
  }
);
