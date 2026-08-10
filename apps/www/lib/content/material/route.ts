import "server-only";

import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  CorpusSourcePathSchema,
  type GitCommitShaSchema,
  type ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import { api } from "@repo/backend/convex/_generated/api";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  decodeMaterialJson,
  isMaterialCounterpart,
  isMaterialSibling,
  makeMaterialProjectionError,
} from "@/lib/content/material/decode";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

interface PublishedMaterialIdentity {
  readonly activeManifestHash: typeof Sha256HashSchema.Type;
  readonly activeReleaseId: typeof ReleaseIdSchema.Type;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
}

/** Complete immutable shell data for one signed material lesson or tombstone. */
export type PublishedMaterialRoute =
  | (PublishedMaterialIdentity & {
      readonly alternates: readonly [];
      readonly projection: null;
      readonly rendererDomain: null;
      readonly siblings: readonly [];
      readonly sourcePath: null;
    })
  | (PublishedMaterialIdentity & {
      readonly alternates: readonly MaterialLessonProjection[];
      readonly projection: MaterialLessonProjection;
      readonly rendererDomain: RendererDomain;
      readonly siblings: readonly MaterialLessonProjection[];
      readonly sourcePath: typeof CorpusSourcePathSchema.Type;
    });

/** Decodes the coherent active release identifiers carried by one route model. */
const decodeActiveIdentity = Effect.fn("NakafaMaterial.decodeActiveIdentity")(
  function* (
    activeManifestHash: null | string,
    activeReleaseId: null | string,
    expectedActiveReleaseId: ContentReleasePin | undefined,
    locale: Locale,
    publicPath: string
  ) {
    const releaseId = yield* decodeContentReleasePin(
      activeReleaseId,
      expectedActiveReleaseId,
      { locale, publicPath }
    );
    if (activeManifestHash === null || releaseId === null) {
      return yield* makeMaterialProjectionError({ locale, publicPath });
    }
    const manifestHash = yield* Schema.decodeUnknown(Sha256HashSchema)(
      activeManifestHash
    ).pipe(
      Effect.mapError(() => makeMaterialProjectionError({ locale, publicPath }))
    );
    return {
      activeManifestHash: manifestHash,
      activeReleaseId: releaseId,
    };
  }
);

/** Reads and validates one complete signed material route model. */
export const readPublishedMaterialRoute = Effect.fn(
  "NakafaMaterial.readPublishedRoute"
)(function* (
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  const result = yield* readRuntimeQuery(api.contentRelease.material.route, {
    ...(expectedActiveReleaseId === undefined
      ? {}
      : { expectedActiveReleaseId }),
    locale,
    publicPath,
  });
  if (!(result.managed && result.familyManaged)) {
    return yield* makeMaterialProjectionError({ locale, publicPath });
  }
  const [active, sourceRevision] = yield* Effect.all([
    decodeActiveIdentity(
      result.activeManifestHash,
      result.activeReleaseId,
      expectedActiveReleaseId,
      locale,
      publicPath
    ),
    decodeSourceRevision(result.sourceRevision, { locale, publicPath }),
  ]);
  if (result.projectionJson === null) {
    return {
      ...active,
      alternates: [],
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourcePath: null,
      sourceRevision,
    } satisfies PublishedMaterialRoute;
  }
  if (result.rendererDomain === null || result.sourcePath === null) {
    return yield* makeMaterialProjectionError({ locale, publicPath });
  }
  const projection = yield* decodeMaterialJson(result.projectionJson, {
    locale,
    publicPath,
  });
  const [alternates, rendererDomain, siblings, sourcePath] = yield* Effect.all([
    Effect.forEach(result.alternateJson, (source) =>
      decodeMaterialJson(source, { locale, publicPath })
    ),
    Schema.decodeUnknown(RendererDomainSchema)(result.rendererDomain),
    Effect.forEach(result.siblingJson, (source) =>
      decodeMaterialJson(source, { locale, publicPath })
    ),
    Schema.decodeUnknown(CorpusSourcePathSchema)(result.sourcePath),
  ]).pipe(
    Effect.mapError(() => makeMaterialProjectionError({ locale, publicPath }))
  );
  const alternateLocales = new Set(
    alternates.map((alternate) => alternate.locale)
  );
  const completeLocaleSet =
    alternateLocales.size === ContentLocaleSchema.literals.length &&
    ContentLocaleSchema.literals.every((alternateLocale) =>
      alternateLocales.has(alternateLocale)
    );
  if (
    projection.locale !== locale ||
    projection.publicPath !== publicPath ||
    alternates.some(
      (alternate) => !isMaterialCounterpart(projection, alternate)
    ) ||
    alternateLocales.size !== alternates.length ||
    !alternates.some(
      (alternate) =>
        alternate.locale === projection.locale &&
        alternate.publicPath === projection.publicPath
    ) ||
    !completeLocaleSet ||
    siblings.some((sibling) => !isMaterialSibling(projection, sibling)) ||
    !siblings.some((sibling) => sibling.publicPath === projection.publicPath)
  ) {
    return yield* makeMaterialProjectionError({ locale, publicPath });
  }
  return {
    ...active,
    alternates,
    projection,
    rendererDomain,
    siblings,
    sourcePath,
    sourceRevision,
  } satisfies PublishedMaterialRoute;
});

/** Caches one exact signed material model under release invalidation. */
export async function getPublishedMaterialRoute(
  locale: Locale,
  publicPath: string,
  expectedActiveReleaseId?: ContentReleasePin
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedMaterialRoute(locale, publicPath, expectedActiveReleaseId)
  );
  applyContentRuntimeCache();
  return result;
}
