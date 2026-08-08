import "server-only";

import { Effect } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedContentCache } from "@/lib/content/cache";
import { verifyMaterialPublication } from "@/lib/content/material/decode";
import { getPublishedMaterialRoute } from "@/lib/content/material/route";
import { renderPublishedMaterial } from "@/lib/content/published/material";

/** Reads one coherent material shell and body without a sequential network waterfall. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const [model, published] = await Promise.all([
    getPublishedMaterialRoute(locale, publicPath),
    renderPublishedMaterial({ locale, publicPath }),
  ]);
  if (!model.projection) {
    return null;
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
