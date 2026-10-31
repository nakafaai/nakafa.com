import { HttpClient } from "@confect/js";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { Array as Arr, Effect } from "effect";
import type { Locale } from "use-intl";
import { toMaterialPlacement } from "@/lib/content/material/navigation";
import {
  decodePublishedMaterialContext,
  type PublishedMaterialIdentity,
} from "@/lib/content/material/projection";
import type { ContentReleasePin } from "@/lib/content/published/release";
import { httpLayer } from "@/lib/convex/http";

/**
 * Reads every curriculum place that shows one material, verified, as a lesson's
 * links read them. The build writes them into the lesson's static page.
 */
export const readPublishedMaterialPlacements = Effect.fn(
  "NakafaMaterial.readPublishedPlacements"
)(function* (
  locale: Locale,
  material: PublishedMaterialIdentity,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const places = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.program.placements, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      appLocale: AppLocaleSchema.make(locale),
      contentKey: material.contentKey,
      materialKey: material.materialKey,
      parentPath: material.parentPath,
      publicPath: material.publicPath,
    })
  ).pipe(Effect.provide(httpLayer()));
  const published = yield* Effect.forEach(places, (place) =>
    decodePublishedMaterialContext(locale, material, place)
  );
  return Arr.map(published, toMaterialPlacement);
});
