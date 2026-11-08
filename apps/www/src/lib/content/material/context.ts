import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect } from "effect";
import type { Locale } from "use-intl";
import { toMaterialPlacement } from "@/lib/content/material/navigation";
import {
  decodePublishedMaterialContext,
  type PublishedMaterialIdentity,
} from "@/lib/content/material/projection";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { queryPinnedContentStore } from "@/lib/content/store/query";

/**
 * Reads every curriculum place that shows one material, verified, as a lesson's
 * links read them. The build writes them into the lesson's static page, so the
 * read goes through the store: a release's places reach Convex once per build.
 * A caller that read the lesson first passes its release, which Convex and the
 * store both hold the read to.
 */
export const readPublishedMaterialPlacements = Effect.fn(
  "NakafaMaterial.readPublishedPlacements"
)(function* (
  locale: Locale,
  material: PublishedMaterialIdentity,
  release?: ActiveContentReleaseId
) {
  const places = yield* queryPinnedContentStore(
    release,
    contentRelease.program.placements,
    {
      ...(release === undefined ? {} : { expectedActiveReleaseId: release }),
      appLocale: AppLocaleSchema.make(locale),
      contentKey: material.contentKey,
      materialKey: material.materialKey,
      parentPath: material.parentPath,
      publicPath: material.publicPath,
    }
  );
  const published = yield* Effect.forEach(places, (place) =>
    decodePublishedMaterialContext(locale, material, place)
  );
  return Arr.map(published, toMaterialPlacement);
});
