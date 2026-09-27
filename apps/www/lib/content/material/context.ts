import { HttpClient } from "@confect/js";
import "server-only";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import type { MaterialContextIdentity } from "@repo/contents/route/material/reference";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { env } from "@/env";
import {
  decodePublishedMaterialContext,
  type PublishedMaterialIdentity,
} from "@/lib/content/material/projection";
import type { ContentReleasePin } from "@/lib/content/published/release";

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
    client.query(refs.public.contentRelease.program.context, {
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
  ).pipe(Effect.provide(HttpClient.layer(env.NEXT_PUBLIC_CONVEX_URL)));
  return yield* decodePublishedMaterialContext(
    locale,
    material,
    context,
    result
  );
});
