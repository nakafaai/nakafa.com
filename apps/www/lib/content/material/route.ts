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
import {
  decodeMaterialClaims,
  decodeMaterialSources,
  type MaterialSourceCandidate,
  type MaterialSourceClaim,
  readPublishedMaterialShell,
} from "@/lib/content/material/ownership";
import {
  decodeMaterialReleasePin,
  type MaterialReleasePin,
} from "@/lib/content/material/release";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Complete immutable shell data for one published material lesson. */
export type PublishedMaterialRoute =
  | {
      readonly activeManifestHash: null;
      readonly activeReleaseId: MaterialReleasePin;
      readonly alternates: readonly [];
      readonly familyManaged: false;
      readonly managed: false;
      readonly projection: null;
      readonly rendererDomain: null;
      readonly siblings: readonly [];
      readonly sourceClaims: readonly MaterialSourceClaim[];
      readonly sourceMaterials: readonly MaterialLessonProjection[];
      readonly sourcePath: null;
      readonly sourceRevision: null;
    }
  | {
      readonly activeManifestHash: typeof Sha256HashSchema.Type;
      readonly activeReleaseId: typeof ReleaseIdSchema.Type;
      readonly alternates: readonly [];
      readonly familyManaged: boolean;
      readonly managed: true;
      readonly projection: null;
      readonly rendererDomain: null;
      readonly siblings: readonly [];
      readonly sourceClaims: readonly MaterialSourceClaim[];
      readonly sourceMaterials: readonly MaterialLessonProjection[];
      readonly sourcePath: null;
      readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
    }
  | {
      readonly activeManifestHash: typeof Sha256HashSchema.Type;
      readonly activeReleaseId: typeof ReleaseIdSchema.Type;
      readonly alternates: readonly MaterialLessonProjection[];
      readonly familyManaged: boolean;
      readonly managed: true;
      readonly projection: MaterialLessonProjection;
      readonly rendererDomain: RendererDomain;
      readonly siblings: readonly MaterialLessonProjection[];
      readonly sourceClaims: readonly MaterialSourceClaim[];
      readonly sourceMaterials: readonly MaterialLessonProjection[];
      readonly sourcePath: typeof CorpusSourcePathSchema.Type;
      readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
    };

/** Decodes the coherent active release identifiers carried by one route model. */
const decodeActiveIdentity = Effect.fn("NakafaMaterial.decodeActiveIdentity")(
  function* (
    activeManifestHash: null | string,
    activeReleaseId: null | string,
    expectedActiveReleaseId: MaterialReleasePin | undefined,
    locale: Locale,
    publicPath: string
  ) {
    const releaseId = yield* decodeMaterialReleasePin(
      activeReleaseId,
      expectedActiveReleaseId,
      { locale, publicPath }
    );
    if (activeManifestHash === null && releaseId === null) {
      return {
        activeManifestHash: null,
        activeReleaseId: null,
      };
    }
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

/** Caches one exact material source overlay under content invalidation. */
export async function getPublishedMaterialShell(
  locale: Locale,
  sourceCandidates: readonly MaterialSourceCandidate[]
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedMaterialShell(locale, sourceCandidates)
  );
  applyContentRuntimeCache();
  return result;
}

/** Reads and validates one complete published material route model. */
export const readPublishedMaterialRoute = Effect.fn(
  "NakafaMaterial.readPublishedRoute"
)(function* (
  locale: Locale,
  publicPath: string,
  sourceCandidates: readonly MaterialSourceCandidate[] = [],
  expectedActiveReleaseId?: MaterialReleasePin
) {
  const result = yield* readRuntimeQuery("contentRelease.material.route", () =>
    fetchRuntimeQuery(api.contentRelease.material.route, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      locale,
      publicPath,
      sourceCandidates: Array.from(sourceCandidates),
    })
  );
  const sourceClaims = yield* decodeMaterialClaims(
    result.sourceClaims,
    sourceCandidates,
    { locale, publicPath }
  );
  const sourceMaterials = yield* decodeMaterialSources(
    result.sourceProjectionJson,
    sourceCandidates,
    { locale, publicPath }
  );
  const sourceRevision = yield* decodeSourceRevision(result.sourceRevision, {
    locale,
    publicPath,
  });
  const active = yield* decodeActiveIdentity(
    result.activeManifestHash,
    result.activeReleaseId,
    expectedActiveReleaseId,
    locale,
    publicPath
  );
  if (!result.managed) {
    return {
      activeManifestHash: null,
      activeReleaseId: active.activeReleaseId,
      alternates: [],
      familyManaged: false,
      managed: false,
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourceClaims,
      sourceMaterials,
      sourcePath: null,
      sourceRevision: null,
    } satisfies PublishedMaterialRoute;
  }
  if (active.activeManifestHash === null || active.activeReleaseId === null) {
    return yield* makeMaterialProjectionError({ locale, publicPath });
  }
  if (result.projectionJson === null) {
    return {
      ...active,
      alternates: [],
      familyManaged: result.familyManaged,
      managed: true,
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourceClaims,
      sourceMaterials,
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
      decodeMaterialJson(source, {
        locale,
        publicPath,
      })
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
    (result.familyManaged && !completeLocaleSet) ||
    siblings.some((sibling) => !isMaterialSibling(projection, sibling)) ||
    !siblings.some((sibling) => sibling.publicPath === projection.publicPath)
  ) {
    return yield* makeMaterialProjectionError({ locale, publicPath });
  }
  return {
    ...active,
    alternates,
    familyManaged: result.familyManaged,
    managed: true,
    projection,
    rendererDomain,
    siblings,
    sourceClaims,
    sourceMaterials,
    sourcePath,
    sourceRevision,
  } satisfies PublishedMaterialRoute;
});

/** Caches one exact material model under content release invalidation. */
export async function getPublishedMaterialRoute(
  locale: Locale,
  publicPath: string,
  sourceCandidates: readonly MaterialSourceCandidate[] = [],
  expectedActiveReleaseId?: MaterialReleasePin
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedMaterialRoute(
      locale,
      publicPath,
      sourceCandidates,
      expectedActiveReleaseId
    )
  );
  applyContentRuntimeCache();
  return result;
}
