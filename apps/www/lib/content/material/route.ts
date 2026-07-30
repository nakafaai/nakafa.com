import "server-only";

import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  type GitCommitShaSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import {
  type RendererDomain,
  RendererDomainSchema,
} from "@nakafa/aksara-contracts/renderer/domain";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyContentRuntimeCache } from "@/lib/content/cache";
import {
  decodeMaterialJson,
  isMaterialCounterpart,
  isMaterialSibling,
  type MaterialProjectionIdentity,
} from "@/lib/content/material/decode";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { decodeSourceRevision } from "@/lib/content/published/origin";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

/** Source identity sent for one bounded source-shell reconciliation. */
export type MaterialSourceCandidate = NonNullable<
  FunctionArgs<typeof api.contentRelease.material.route>["sourceCandidates"]
>[number];

/** Exact-owned source identity selected by the active material release. */
export type MaterialSourceClaim =
  | {
      readonly contentKey: MaterialSourceCandidate["contentKey"];
      readonly kind: "missing";
      readonly locale: Locale;
    }
  | {
      readonly contentKey: MaterialSourceCandidate["contentKey"];
      readonly kind: "found";
      readonly locale: Locale;
      readonly projection: MaterialLessonProjection;
    };

/** Complete immutable shell data for one published material lesson. */
export type PublishedMaterialRoute =
  | {
      readonly activeManifestHash: null;
      readonly activeReleaseId: null;
      readonly alternates: readonly [];
      readonly familyManaged: false;
      readonly managed: false;
      readonly projection: null;
      readonly rendererDomain: null;
      readonly siblings: readonly [];
      readonly sourceClaims: readonly MaterialSourceClaim[];
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

/** Decodes exact claims used to remove or replace temporary source routes. */
const decodeSourceClaims = Effect.fn("NakafaMaterial.decodeSourceClaims")(
  function* (
    claims: FunctionReturnType<
      typeof api.contentRelease.material.route
    >["sourceClaims"],
    candidates: readonly MaterialSourceCandidate[],
    identity: MaterialProjectionIdentity
  ) {
    const decoded = yield* Effect.forEach(claims, (claim) =>
      Effect.gen(function* () {
        const contentKey = yield* Schema.decodeUnknown(ContentKeySchema)(
          claim.contentKey
        ).pipe(
          Effect.mapError(() =>
            projectionError(identity.locale, identity.publicPath)
          )
        );
        if (
          !candidates.some(
            (candidate) =>
              candidate.contentKey === contentKey &&
              candidate.locale === claim.locale
          )
        ) {
          return yield* projectionError(identity.locale, identity.publicPath);
        }
        if (claim.kind === "missing") {
          const missing: MaterialSourceClaim = {
            contentKey,
            kind: claim.kind,
            locale: claim.locale,
          };
          return missing;
        }
        const projection = yield* decodeMaterialJson(
          claim.projectionJson,
          identity
        );
        if (
          projection.contentKey !== contentKey ||
          projection.locale !== claim.locale
        ) {
          return yield* projectionError(identity.locale, identity.publicPath);
        }
        const found: MaterialSourceClaim = {
          contentKey,
          kind: claim.kind,
          locale: claim.locale,
          projection,
        };
        return found;
      })
    );
    const identities = new Set(
      decoded.map((claim) => `${claim.locale}\0${claim.contentKey}`)
    );
    if (identities.size !== decoded.length) {
      return yield* projectionError(identity.locale, identity.publicPath);
    }
    return decoded;
  }
);

/** Reads and validates one complete published material route model. */
export const readPublishedMaterialRoute = Effect.fn(
  "NakafaMaterial.readPublishedRoute"
)(function* (
  locale: Locale,
  publicPath: string,
  sourceCandidates: readonly MaterialSourceCandidate[] = []
) {
  const result = yield* readRuntimeQuery("contentRelease.material.route", () =>
    fetchRuntimeQuery(api.contentRelease.material.route, {
      locale,
      publicPath,
      sourceCandidates: Array.from(sourceCandidates),
    })
  );
  const sourceClaims = yield* decodeSourceClaims(
    result.sourceClaims,
    sourceCandidates,
    { locale, publicPath }
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
      familyManaged: false,
      managed: false,
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourceClaims,
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
      familyManaged: result.familyManaged,
      managed: true,
      projection: null,
      rendererDomain: null,
      siblings: [],
      sourceClaims,
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
    return yield* projectionError(locale, publicPath);
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
    sourcePath,
    sourceRevision,
  } satisfies PublishedMaterialRoute;
});

/** Caches one exact material model under content release invalidation. */
export async function getPublishedMaterialRoute(
  locale: Locale,
  publicPath: string,
  sourceCandidates: readonly MaterialSourceCandidate[] = []
) {
  "use cache";

  const result = await Effect.runPromise(
    readPublishedMaterialRoute(locale, publicPath, sourceCandidates)
  );
  applyContentRuntimeCache();
  return result;
}
