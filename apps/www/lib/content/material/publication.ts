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
import { getPublishedMaterialRoute } from "@/lib/content/material/route";
import { readRenderedMaterial } from "@/lib/content/published/material";

/** Caches one coherent material publication at the Next.js boundary. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const appLocale = AppLocaleSchema.make(locale);
  const readPublished = readRenderedMaterial({ appLocale, publicPath }).pipe(
    Effect.catchTag("ContentRuntimeMissingError", () => Effect.succeed(null))
  );
  const [model, published] = await Promise.all([
    getPublishedMaterialRoute(locale, publicPath),
    Effect.runPromise(readPublished),
  ]);

  applyPublishedCatalogCache("material");
  if (!model.projection) {
    if (published) {
      return await Effect.runPromise(
        Effect.fail(makeMaterialProjectionError({ appLocale, publicPath }))
      );
    }
    return null;
  }
  if (!published) {
    return await Effect.runPromise(
      Effect.fail(makeMaterialProjectionError({ appLocale, publicPath }))
    );
  }

  await Effect.runPromise(
    verifyMaterialPublication(
      {
        activeReleaseId: model.activeReleaseId,
        projection: model.projection,
      },
      published
    )
  );
  applyPublishedContentCache("material", published.artifactHash);

  return { model, published };
}
