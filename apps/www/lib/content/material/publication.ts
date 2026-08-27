import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  applyPublishedCatalogCache,
  applyPublishedContentCache,
} from "@/lib/content/cache";
import {
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { readPublishedMaterialRoute } from "@/lib/content/material/route";
import { readRenderedMaterial } from "@/lib/content/published/material";

/** Reads one bounded route model and its signed body concurrently. */
const readMaterialPublication = Effect.fn("NakafaMaterial.readPublication")(
  function* (locale: Locale, publicPath: string) {
    const appLocale = AppLocaleSchema.make(locale);
    const [model, published] = yield* Effect.all(
      [
        readPublishedMaterialRoute(locale, publicPath),
        readRenderedMaterial({ appLocale, publicPath }).pipe(
          Effect.catchTag("ContentRuntimeMissingError", () =>
            Effect.succeed(null)
          )
        ),
      ],
      { concurrency: "unbounded" }
    );

    yield* Effect.sync(() => applyPublishedCatalogCache("material"));
    if (!model.projection) {
      if (published) {
        return yield* makeMaterialProjectionError({ appLocale, publicPath });
      }
      return null;
    }
    if (!published) {
      return yield* makeMaterialProjectionError({ appLocale, publicPath });
    }

    yield* verifyMaterialPublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      published
    );
    yield* Effect.sync(() =>
      applyPublishedContentCache("material", published.artifactHash)
    );

    return { model, published };
  }
);

/** Caches one coherent material publication at the Next.js boundary. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  return await Effect.runPromise(readMaterialPublication(locale, publicPath));
}
