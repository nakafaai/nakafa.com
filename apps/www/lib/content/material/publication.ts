import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import { cacheLife } from "next/cache";
import type { Locale } from "next-intl";
import { cache } from "react";
import { env } from "@/env";
import { applyContentCache } from "@/lib/content/cache";
import {
  decodeMaterialJson,
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
    source: Effect.Success<ReturnType<typeof assembleMaterialSource>>,
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
  source: Effect.Success<ReturnType<typeof assembleMaterialSource>>,
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

/** Authenticates the publication shared by a lesson and its cached navigation. */
const assembleMaterialSource = Effect.fn("NakafaMaterial.assembleSource")(
  function* (
    source: FunctionReturnType<typeof api.contentRelease.material.lesson>,
    navigation: FunctionReturnType<
      typeof api.contentRelease.material.navigation
    > | null,
    locale: Locale,
    publicPath: string
  ) {
    const input = { appLocale: AppLocaleSchema.make(locale), publicPath };
    if (source.materialKey === null) {
      if (source.model.projectionJson !== null || navigation !== null) {
        return yield* makeMaterialProjectionError(input);
      }
    } else {
      if (
        source.model.projectionJson === null ||
        navigation === null ||
        navigation.activeReleaseId !== source.model.activeReleaseId ||
        navigation.activeManifestHash !== source.model.activeManifestHash
      ) {
        return yield* makeMaterialProjectionError(input);
      }
      const projection = yield* decodeMaterialJson(
        source.model.projectionJson,
        input
      );
      if (projection.materialKey !== source.materialKey) {
        return yield* makeMaterialProjectionError(input);
      }
    }
    return {
      model: { ...source.model, siblingJson: navigation?.siblingJson ?? [] },
      runtimeJson: source.runtimeJson,
    };
  }
);

/** The release id makes a verified group immutable across its lesson URLs.
 * New publications select a new key; mutable lesson caches still use the
 * material tag. Never cache a failed or mismatched publication lookup. */
async function readMaterialNavigation(
  locale: Locale,
  materialKey: string,
  expectedActiveReleaseId: string
) {
  "use cache";

  cacheLife("max");
  return await fetchQuery(
    api.contentRelease.material.navigation,
    {
      appLocale: AppLocaleSchema.make(locale),
      expectedActiveReleaseId,
      materialKey,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
}

class MaterialReadError extends Schema.TaggedError<MaterialReadError>()(
  "MaterialReadError",
  { cause: Schema.Unknown, stage: Schema.Literals(["lesson", "navigation"]) }
) {}

/** Starts native IO before Effect at the request-less prerendering seam. */
async function fetchMaterialLesson(locale: Locale, publicPath: string) {
  return await fetchQuery(
    api.contentRelease.material.lesson,
    {
      appLocale: AppLocaleSchema.make(locale),
      publicPath,
    },
    { url: env.NEXT_PUBLIC_CONVEX_URL }
  );
}

const completeMaterialSource = Effect.fn("NakafaMaterial.completeSource")(
  function* (
    source: FunctionReturnType<typeof api.contentRelease.material.lesson>,
    locale: Locale,
    publicPath: string
  ) {
    const { materialKey } = source;
    const { activeReleaseId } = source.model;
    const navigation =
      materialKey !== null && activeReleaseId !== null
        ? yield* Effect.tryPromise({
            try: () =>
              readMaterialNavigation(locale, materialKey, activeReleaseId),
            catch: (cause) =>
              new MaterialReadError({ cause, stage: "navigation" }),
          })
        : null;
    return yield* assembleMaterialSource(
      source,
      navigation,
      locale,
      publicPath
    );
  }
);

/** Rechecks a failed navigation read and retries only after a release change.
 * Next serializes errors across cache boundaries, so a fresh lesson identity
 * proves the transition without relying on a preserved ConvexError class. */
const readMaterialSource = Effect.fn("NakafaMaterial.readSource")(function* (
  initial: FunctionReturnType<typeof api.contentRelease.material.lesson>,
  locale: Locale,
  publicPath: string
) {
  return yield* completeMaterialSource(initial, locale, publicPath).pipe(
    Effect.catchTag("MaterialReadError", (error) =>
      Effect.tryPromise({
        try: () => fetchMaterialLesson(locale, publicPath),
        catch: (cause) => new MaterialReadError({ cause, stage: "lesson" }),
      }).pipe(
        Effect.flatMap((source) =>
          source.model.activeReleaseId === initial.model.activeReleaseId
            ? Effect.fail(error)
            : completeMaterialSource(source, locale, publicPath)
        )
      )
    )
  );
});

/** Reads and verifies one signed material delivery inside the content cache. */
async function readMaterialDelivery(locale: Locale, publicPath: string) {
  "use cache";

  applyContentCache("material");
  // Start native IO before Effect during request-less static rendering.
  // https://nextjs.org/docs/messages/next-prerender-current-time
  const source = await fetchMaterialLesson(locale, publicPath);
  return await Effect.runPromise(
    readMaterialSource(source, locale, publicPath).pipe(
      Effect.flatMap((assembled) =>
        decodeMaterialDelivery(assembled, locale, publicPath)
      )
    )
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
  const source = await fetchMaterialLesson(locale, publicPath);
  return await Effect.runPromise(
    readMaterialSource(source, locale, publicPath).pipe(
      Effect.flatMap((assembled) =>
        decodeMaterialModel(assembled, locale, publicPath)
      )
    )
  );
}

export const getMaterialModel = cache(readMaterialModel);
