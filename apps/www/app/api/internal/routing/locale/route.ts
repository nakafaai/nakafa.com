import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { hasLocale } from "next-intl";
import { resolveLocalizedNavigationHref } from "@/lib/routing/locale/resolve";

/** Narrows the query string target locale before route projection is attempted. */
function readTargetLocale(value: string | null) {
  if (value && hasLocale(routing.locales, value)) {
    return value;
  }

  return;
}

/**
 * Maps one browser href to the selected locale's route-owned href and converts
 * typed projection failures into route-handler HTTP responses.
 */
const readLocaleRouteResponse = Effect.fn("www.routing.locale.route")(
  function* (request: NextRequest) {
    const url = new URL(request.url);
    const href = url.searchParams.get("href");
    const locale = readTargetLocale(url.searchParams.get("locale"));

    if (!(href && locale)) {
      return NextResponse.json(
        { error: "Invalid locale route request" },
        {
          status: 400,
        }
      );
    }

    return yield* resolveLocalizedNavigationHref({
      href,
      locale,
    }).pipe(
      Effect.map((localizedHref) => NextResponse.json({ href: localizedHref })),
      Effect.catchTag("InvalidLocalizedHrefError", () =>
        Effect.succeed(
          NextResponse.json({ error: "Invalid href" }, { status: 400 })
        )
      ),
      Effect.catchTag("MissingLocalizedRouteProjectionError", (error) =>
        Effect.succeed(
          NextResponse.json(
            {
              error: "Missing localized route projection",
              path: error.publicPath,
            },
            { status: 404 }
          )
        )
      )
    );
  }
);

/** Resolves the active browser URL to the selected locale's projected href. */
export function GET(request: NextRequest) {
  return Effect.runPromise(readLocaleRouteResponse(request));
}
