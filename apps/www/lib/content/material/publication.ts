import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import { cache } from "react";
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

/** Verifies the signed query result without evaluating its immutable body.
 *
 * Static consumers such as social images resolve metadata through this seam
 * so their module graph never renders interactive renderers. */
export const decodeMaterialModel = Effect.fn("NakafaMaterial.decodeModel")(
  function* (
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
    return { model, narrowed };
  }
);

/** Verifies the complete query result before evaluating its immutable body. */
export const decodeMaterialDelivery = Effect.fn(
  "NakafaMaterial.decodeDelivery"
)(function* (
  source: FunctionReturnType<typeof api.contentRelease.material.delivery>,
  locale: Locale,
  publicPath: string
) {
  const decoded = yield* decodeMaterialModel(source, locale, publicPath);
  if (!decoded) {
    return null;
  }
  const published = yield* renderMaterialArtifact(decoded.narrowed);
  return { model: decoded.model, published };
});

/** Fetches one signed delivery row shared by body and metadata readers. */
async function fetchMaterialSource(locale: Locale, publicPath: string) {
  return await fetchQuery(
    api.contentRelease.material.delivery,
    {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
}

/** Reads and verifies one signed material delivery inside the content cache. */
async function readMaterialDelivery(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("material");
  // Start native IO before Effect during request-less static rendering.
  // https://nextjs.org/docs/messages/next-prerender-current-time
  const source = await fetchMaterialSource(locale, publicPath);
  return await Effect.runPromise(
    decodeMaterialDelivery(source, locale, publicPath)
  );
}

/**
 * Shares one verified delivery between the material metadata and body in a
 * single render pass. https://react.dev/reference/react/cache
 */
export const getMaterialPublication = cache(readMaterialDelivery);

/** Reads and verifies signed release metadata without rendering its body.
 *
 * Social images resolve copy through this seam so a missing release falls
 * back to brand artwork instead of rendering the application shell. */
async function readMaterialModel(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("material");
  const source = await fetchMaterialSource(locale, publicPath);
  return await Effect.runPromise(
    decodeMaterialModel(source, locale, publicPath)
  );
}

export const getMaterialModel = cache(readMaterialModel);
