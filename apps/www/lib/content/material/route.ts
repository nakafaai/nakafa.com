import "server-only";
import {
  CorpusSourcePathSchema,
  type GitCommitShaSchema,
  type ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ActiveAppLocaleListSchema,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
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
      { appLocale: AppLocaleSchema.make(locale), publicPath }
    );
    if (activeManifestHash === null || releaseId === null) {
      return yield* makeMaterialProjectionError({
        appLocale: AppLocaleSchema.make(locale),
        publicPath,
      });
    }
    const manifestHash = yield* Schema.decodeEffect(Sha256HashSchema)(
      activeManifestHash
    ).pipe(
      Effect.mapError(() =>
        makeMaterialProjectionError({
          appLocale: AppLocaleSchema.make(locale),
          publicPath,
        })
      )
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
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(
    api.contentRelease.material.publication,
    {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      appLocale,
      publicPath,
    }
  );
  const decodedActiveAppLocales = Schema.decodeUnknownEffect(
    ActiveAppLocaleListSchema
  )(result.activeAppLocales).pipe(
    Effect.mapError(() =>
      makeMaterialProjectionError({ appLocale, publicPath })
    )
  );
  const [active, activeAppLocales, sourceRevision] = yield* Effect.all([
    decodeActiveIdentity(
      result.activeManifestHash,
      result.activeReleaseId,
      expectedActiveReleaseId,
      locale,
      publicPath
    ),
    decodedActiveAppLocales,
    decodeSourceRevision(result.sourceRevision, { appLocale, publicPath }),
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
    return yield* makeMaterialProjectionError({ appLocale, publicPath });
  }
  const projection = yield* decodeMaterialJson(result.projectionJson, {
    appLocale,
    publicPath,
  });
  const [alternates, rendererDomain, siblings, sourcePath] = yield* Effect.all([
    Effect.forEach(result.alternateJson, (source) =>
      decodeMaterialJson(source, { appLocale, publicPath })
    ),
    Schema.decodeEffect(RendererDomainSchema)(result.rendererDomain),
    Effect.forEach(result.siblingJson, (source) =>
      decodeMaterialJson(source, { appLocale, publicPath })
    ),
    Schema.decodeEffect(CorpusSourcePathSchema)(result.sourcePath),
  ]).pipe(
    Effect.mapError(() =>
      makeMaterialProjectionError({ appLocale, publicPath })
    )
  );
  const alternateLocales = new Set(
    alternates.map((alternate) => alternate.appLocale)
  );
  const completeLocaleSet =
    alternateLocales.size === activeAppLocales.length &&
    activeAppLocales.every((alternateLocale) =>
      alternateLocales.has(alternateLocale)
    );
  if (
    projection.appLocale !== appLocale ||
    projection.publicPath !== publicPath ||
    alternates.some(
      (alternate) => !isMaterialCounterpart(projection, alternate)
    ) ||
    alternateLocales.size !== alternates.length ||
    !alternates.some(
      (alternate) =>
        alternate.appLocale === projection.appLocale &&
        alternate.publicPath === projection.publicPath
    ) ||
    !completeLocaleSet ||
    siblings.some((sibling) => !isMaterialSibling(projection, sibling)) ||
    !siblings.some((sibling) => sibling.publicPath === projection.publicPath)
  ) {
    return yield* makeMaterialProjectionError({ appLocale, publicPath });
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
