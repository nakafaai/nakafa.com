import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { env } from "@/env";
import { applyContentCache } from "@/lib/content/cache";
import {
  makeMaterialProjectionError,
  verifyMaterialPublication,
} from "@/lib/content/material/decode";
import { decodePublishedMaterialRoute } from "@/lib/content/material/route";
import { decodePublishedDelivery } from "@/lib/content/published/exchange";
import {
  decodeMaterialData,
  renderMaterialArtifact,
} from "@/lib/content/published/material";

/** Verifies the complete query result before evaluating its immutable body. */
export const decodeMaterialDelivery = Effect.fn(
  "NakafaMaterial.decodeDelivery"
)(function* (
  source: FunctionReturnType<typeof api.contentRelease.material.delivery>,
  locale: Locale,
  publicPath: string
) {
  const input = { appLocale: AppLocaleSchema.make(locale), publicPath };
  const model = yield* decodePublishedMaterialRoute(
    source.model,
    locale,
    publicPath
  );
  if (!model.projection) {
    if (source.runtimeJson !== null) {
      return yield* makeMaterialProjectionError(input);
    }
    return null;
  }
  if (source.runtimeJson === null) {
    return yield* makeMaterialProjectionError(input);
  }
  const data = yield* decodePublishedDelivery(input, source.runtimeJson);
  const narrowed = yield* decodeMaterialData(data, input);
  yield* verifyMaterialPublication(
    { activeReleaseId: model.activeReleaseId, projection: model.projection },
    narrowed
  );
  const published = yield* renderMaterialArtifact(narrowed);
  return { model, published };
});

/** Caches a coherent shell selection separately from immutable body rendering. */
export async function getMaterialPublication(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  applyContentCache("material");
  // Start native IO before Effect during request-less static rendering.
  // https://nextjs.org/docs/messages/next-prerender-current-time
  const source = await fetchQuery(
    api.contentRelease.material.delivery,
    {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
  return await Effect.runPromise(
    decodeMaterialDelivery(source, locale, publicPath)
  );
}
