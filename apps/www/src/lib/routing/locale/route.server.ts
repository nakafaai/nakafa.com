import { decodeLocale } from "@repo/internationalization/src/locale";
import { Effect } from "effect";
import { resolveLocalizedNavigationHref } from "@/lib/routing/locale/resolve";

/**
 * Resolves the active browser URL to the selected locale's projected href. It
 * maps one browser href to the selected locale's route-owned href and converts
 * typed projection failures into route-handler HTTP responses.
 */
export const serveLocalizedHref = Effect.fn("www.routing.locale.serve")(
  function* ({ request }: { readonly request: Request }) {
    const url = new URL(request.url);
    const href = url.searchParams.get("href");
    const locale = decodeLocale(url.searchParams.get("locale"));

    if (!(href && locale._tag === "Some")) {
      return Response.json(
        { error: "Invalid locale route request" },
        { status: 400 }
      );
    }

    return yield* resolveLocalizedNavigationHref({
      href,
      locale: locale.value,
    }).pipe(
      Effect.map((localizedHref) => Response.json({ href: localizedHref })),
      Effect.catchTags({
        InvalidLocalizedHrefError: () =>
          Effect.succeed(
            Response.json({ error: "Invalid href" }, { status: 400 })
          ),
        MissingLocalizedRouteProjectionError: (error) =>
          Effect.succeed(
            Response.json(
              {
                error: "Missing localized route projection",
                path: error.publicPath,
              },
              { status: 404 }
            )
          ),
      })
    );
  }
);
