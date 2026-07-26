import "server-only";

import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  CorpusSourcePathSchema,
  type GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { MaterialProjectionWire } from "@nakafa/aksara-contracts/projection/material";
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
} from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Complete immutable shell data for one published material lesson. */
export type PublishedMaterialRoute =
  | {
      readonly activeManifestHash: null;
      readonly activeReleaseId: null;
      readonly alternates: readonly [];
      readonly managed: false;
      readonly projection: null;
      readonly rendererDomain: null;
      readonly siblings: readonly [];
      readonly sourcePath: null;
      readonly sourceRevision: null;
    }
  | {
      readonly activeManifestHash: typeof Sha256HashSchema.Type;
      readonly activeReleaseId: typeof ReleaseIdSchema.Type;
      readonly alternates: readonly [];
      readonly managed: true;
      readonly projection: null;
      readonly rendererDomain: null;
      readonly siblings: readonly [];
      readonly sourcePath: null;
      readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
    }
  | {
      readonly activeManifestHash: typeof Sha256HashSchema.Type;
      readonly activeReleaseId: typeof ReleaseIdSchema.Type;
      readonly alternates: readonly MaterialProjectionWire[];
      readonly managed: true;
      readonly projection: MaterialProjectionWire;
      readonly rendererDomain: RendererDomain;
      readonly siblings: readonly MaterialProjectionWire[];
      readonly sourcePath: typeof CorpusSourcePathSchema.Type;
      readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
    };

/** Maps malformed route data to the exact public projection failure. */
function projectionError(locale: Locale, publicPath: string) {
  return new PublishedProjectionError({ locale, publicPath });
}

/** Decodes the active release identifiers carried by one managed model. */
const decodeActiveIdentity = Effect.fn("NakafaMaterial.decodeActiveIdentity")(
  function* (
    activeManifestHash: null | string,
    activeReleaseId: null | string,
    locale: Locale,
    publicPath: string
  ) {
    if (activeManifestHash === null || activeReleaseId === null) {
      return yield* projectionError(locale, publicPath);
    }
    return yield* Effect.all({
      activeManifestHash:
        Schema.decodeUnknown(Sha256HashSchema)(activeManifestHash),
      activeReleaseId: Schema.decodeUnknown(ReleaseIdSchema)(activeReleaseId),
    }).pipe(Effect.mapError(() => projectionError(locale, publicPath)));
  }
);

/** Reads and validates one complete published material route model. */
export const readPublishedMaterialRoute = Effect.fn(
  "NakafaMaterial.readPublishedRoute"
)(function* (locale: Locale, publicPath: string) {
  const result = yield* readRuntimeQuery("contentRelease.material.route", () =>
    fetchRuntimeQuery(api.contentRelease.material.route, {
      locale,
      publicPath,
    })
  );
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    locale,
    publicPath,
  });
  if (!result.managed) {
    return {
      activeManifestHash: null,
      activeReleaseId: null,
      alternates: [],
      managed: false,
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourcePath: null,
      sourceRevision: null,
    } satisfies PublishedMaterialRoute;
  }
  const active = yield* decodeActiveIdentity(
    result.activeManifestHash,
    result.activeReleaseId,
    locale,
    publicPath
  );
  if (result.projectionJson === null) {
    return {
      ...active,
      alternates: [],
      managed: true,
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourcePath: null,
      sourceRevision,
    } satisfies PublishedMaterialRoute;
  }
  if (result.rendererDomain === null || result.sourcePath === null) {
    return yield* projectionError(locale, publicPath);
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
      decodeMaterialJson(source, {
        locale,
        publicPath,
      })
    ),
    Schema.decodeUnknown(CorpusSourcePathSchema)(result.sourcePath),
  ]).pipe(Effect.mapError(() => projectionError(locale, publicPath)));
  const alternateLocales = new Set(
    alternates.map((alternate) => alternate.locale)
  );
  if (
    projection.locale !== locale ||
    projection.publicPath !== publicPath ||
    alternates.some(
      (alternate) => !isMaterialCounterpart(projection, alternate)
    ) ||
    alternateLocales.size !== ContentLocaleSchema.literals.length ||
    ContentLocaleSchema.literals.some(
      (alternateLocale) => !alternateLocales.has(alternateLocale)
    ) ||
    siblings.some((sibling) => !isMaterialSibling(projection, sibling)) ||
    !siblings.some((sibling) => sibling.publicPath === projection.publicPath)
  ) {
    return yield* projectionError(locale, publicPath);
  }
  return {
    ...active,
    alternates,
    managed: true,
    projection,
    rendererDomain,
    siblings,
    sourcePath,
    sourceRevision,
  } satisfies PublishedMaterialRoute;
});

/** Caches one exact material model under content release invalidation. */
export async function getPublishedMaterialRoute(
  locale: Locale,
  publicPath: string
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedMaterialRoute(locale, publicPath)
  );
  applyContentRuntimeCache();
  return result;
}
