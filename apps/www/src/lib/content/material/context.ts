import { HttpClient } from "@confect/js";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import type { MaterialContextIdentity } from "@repo/contents/route/material/reference";
import { Effect } from "effect";
import type { Locale } from "use-intl";
import { toMaterialPlacement } from "@/lib/content/material/navigation";
import {
  decodePublishedMaterialContext,
  type PublishedMaterialIdentity,
} from "@/lib/content/material/projection";
import type { ContentReleasePin } from "@/lib/content/published/release";
import { httpLayer } from "@/lib/convex/http";

/** Reads one exact published curriculum context for a material identity. */
export const readPublishedMaterialContext = Effect.fn(
  "NakafaMaterial.readPublishedContext"
)(function* (
  locale: Locale,
  material: PublishedMaterialIdentity,
  context: MaterialContextIdentity,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* Effect.flatMap(HttpClient.HttpClient, (client) =>
    client.query(contentRelease.program.context, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : {
            expectedActiveReleaseId,
          }),
      contentKey: material.contentKey,
      appLocale,
      materialKey: material.materialKey,
      nodeKey: context.nodeKey,
      parentPath: material.parentPath,
      programKey: context.programKey,
      publicPath: material.publicPath,
    })
  ).pipe(Effect.provide(httpLayer()));
  return yield* decodePublishedMaterialContext(
    locale,
    material,
    context,
    result
  );
});

/**
 * Reads the part of one verified curriculum placement that a lesson's links
 * read, or none when the release places the lesson under no such context. The
 * release decides the placement, so a forged hint finds nothing to verify.
 */
export const readPublishedMaterialPlacement = Effect.fn(
  "NakafaMaterial.readPublishedPlacement"
)(function* (
  locale: Locale,
  material: PublishedMaterialIdentity,
  context: MaterialContextIdentity
) {
  const published = yield* readPublishedMaterialContext(
    locale,
    material,
    context
  );
  return published === null ? null : toMaterialPlacement(published);
});
