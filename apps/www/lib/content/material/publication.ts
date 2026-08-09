import "server-only";

import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
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
import { renderPublishedMaterial } from "@/lib/content/published/material";

/** Reads one coherent material shell and body without a sequential network waterfall. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const readPublished = Effect.tryPromise(() =>
    renderPublishedMaterial({ locale, publicPath })
  ).pipe(
    Effect.catchIf(
      (failure) => failure.error instanceof ContentRuntimeMissingError,
      () => Effect.succeed(null)
    )
  );
  const [model, published] = await Promise.all([
    getPublishedMaterialRoute(locale, publicPath),
    Effect.runPromise(readPublished),
  ]);
  if (!model.projection) {
    applyPublishedCatalogCache("material");
    return null;
  }
  if (!published) {
    return await Effect.runPromise(
      Effect.fail(makeMaterialProjectionError({ locale, publicPath }))
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
