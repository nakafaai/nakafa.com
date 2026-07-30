import "server-only";

import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import type { MaterialLessonProjection } from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import {
  MATERIAL_SOURCE_GROUP_LIMIT,
  MATERIAL_SOURCE_LIMIT,
} from "@repo/backend/convex/contentRelease/material/limits";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  decodeMaterialJson,
  type MaterialProjectionIdentity,
  makeMaterialProjectionError,
} from "@/lib/content/material/decode";
import {
  decodeMaterialReleasePin,
  type MaterialReleasePin,
} from "@/lib/content/material/release";
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

/** Exact-owned projections discovered inside one temporary source shell. */
export interface MaterialSourceModel {
  readonly claims: readonly MaterialSourceClaim[];
  readonly materials: readonly MaterialLessonProjection[];
}

/** Decodes exact claims used to remove or replace temporary source routes. */
export const decodeMaterialClaims = Effect.fn(
  "NakafaMaterial.decodeSourceClaims"
)(function* (
  claims: FunctionReturnType<
    typeof api.contentRelease.material.claims
  >["sourceClaims"],
  candidates: readonly MaterialSourceCandidate[],
  identity: MaterialProjectionIdentity
) {
  const decoded = yield* Effect.forEach(claims, (claim) =>
    Effect.gen(function* () {
      const contentKey = yield* Schema.decodeUnknown(ContentKeySchema)(
        claim.contentKey
      ).pipe(Effect.mapError(() => makeMaterialProjectionError(identity)));
      if (
        !candidates.some(
          (candidate) =>
            candidate.contentKey === contentKey &&
            candidate.locale === claim.locale
        )
      ) {
        return yield* makeMaterialProjectionError(identity);
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
        return yield* makeMaterialProjectionError(identity);
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
    return yield* makeMaterialProjectionError(identity);
  }
  return decoded;
});

/** Decodes exact-owned rows discovered beside temporary source routes. */
export const decodeMaterialSources = Effect.fn(
  "NakafaMaterial.decodeSourceMaterials"
)(function* (
  sources: readonly string[],
  candidates: readonly MaterialSourceCandidate[],
  identity: MaterialProjectionIdentity
) {
  const materials = yield* Effect.forEach(sources, (source) =>
    decodeMaterialJson(source, identity)
  );
  const parentPaths = new Set(
    candidates.flatMap((candidate) =>
      candidate.locale === identity.locale && candidate.parentPath
        ? [candidate.parentPath]
        : []
    )
  );
  const identities = new Set(
    materials.map((material) => `${material.locale}\0${material.contentKey}`)
  );
  if (
    identities.size !== materials.length ||
    materials.some(
      (material) =>
        material.locale !== identity.locale ||
        !parentPaths.has(material.parentPath)
    )
  ) {
    return yield* makeMaterialProjectionError(identity);
  }
  return materials;
});

/** Reads exact ownership overlays for one bounded source material set. */
export const readPublishedMaterialClaims = Effect.fn(
  "NakafaMaterial.readPublishedClaims"
)(function* (
  locale: Locale,
  sourceCandidates: readonly MaterialSourceCandidate[],
  expectedActiveReleaseId?: MaterialReleasePin
) {
  if (sourceCandidates.length === 0) {
    return [];
  }
  const identities = new Set(
    sourceCandidates.map(
      (candidate) => `${candidate.locale}\0${candidate.contentKey}`
    )
  );
  if (identities.size !== sourceCandidates.length) {
    return yield* makeMaterialProjectionError({
      locale,
      publicPath: "materials",
    });
  }
  const result = yield* readPublishedMaterialClaimBatches(
    locale,
    sourceCandidates,
    expectedActiveReleaseId
  );
  return result.claims;
});

/** Reads release-pinned exact claims across backend-sized batches. */
const readPublishedMaterialClaimBatches = Effect.fn(
  "NakafaMaterial.readPublishedClaimBatches"
)(function* (
  locale: Locale,
  sourceCandidates: readonly MaterialSourceCandidate[],
  initialReleaseId?: MaterialReleasePin
) {
  if (sourceCandidates.length === 0) {
    return { activeReleaseId: initialReleaseId, claims: [] };
  }
  const batches: MaterialSourceCandidate[][] = [];
  for (
    let offset = 0;
    offset < sourceCandidates.length;
    offset += MATERIAL_SOURCE_LIMIT
  ) {
    batches.push(
      Array.from(sourceCandidates.slice(offset, offset + MATERIAL_SOURCE_LIMIT))
    );
  }
  const claims: MaterialSourceClaim[] = [];
  let activeReleaseId = initialReleaseId;
  for (const batch of batches) {
    const result = yield* readRuntimeQuery(
      "contentRelease.material.claims",
      () =>
        fetchRuntimeQuery(api.contentRelease.material.claims, {
          ...(activeReleaseId === undefined
            ? {}
            : { expectedActiveReleaseId: activeReleaseId }),
          sourceCandidates: batch,
        })
    );
    const identity = { locale, publicPath: "materials" };
    activeReleaseId = yield* decodeMaterialReleasePin(
      result.activeReleaseId,
      activeReleaseId,
      identity
    );
    claims.push(
      ...(yield* decodeMaterialClaims(result.sourceClaims, batch, identity))
    );
  }
  return { activeReleaseId, claims };
});

/** Reads exact claims and group rows for one temporary source shell. */
export const readPublishedMaterialShell = Effect.fn(
  "NakafaMaterial.readPublishedShell"
)(function* (
  locale: Locale,
  sourceCandidates: readonly MaterialSourceCandidate[]
) {
  const grouped = new Map<string, MaterialSourceCandidate[]>();
  const ungrouped: MaterialSourceCandidate[] = [];
  for (const candidate of sourceCandidates) {
    if (!candidate.parentPath) {
      ungrouped.push(candidate);
      continue;
    }
    grouped.set(candidate.parentPath, [
      ...(grouped.get(candidate.parentPath) ?? []),
      candidate,
    ]);
  }
  const groups = Array.from(grouped.values());
  const batches: MaterialSourceCandidate[][] = [];
  for (
    let offset = 0;
    offset < groups.length;
    offset += MATERIAL_SOURCE_GROUP_LIMIT
  ) {
    batches.push(
      groups.slice(offset, offset + MATERIAL_SOURCE_GROUP_LIMIT).flat()
    );
  }
  const models: MaterialSourceModel[] = [];
  let activeReleaseId: MaterialReleasePin | undefined;
  for (const batch of batches) {
    const result = yield* readPublishedMaterialShellBatch(
      locale,
      batch,
      activeReleaseId
    );
    activeReleaseId = result.activeReleaseId;
    models.push(result.model);
  }
  const ungroupedResult = yield* readPublishedMaterialClaimBatches(
    locale,
    ungrouped,
    activeReleaseId
  );
  return {
    claims: [
      ...models.flatMap(({ claims }) => claims),
      ...ungroupedResult.claims,
    ],
    materials: models.flatMap(({ materials }) => materials),
  } satisfies MaterialSourceModel;
});

/** Reads one backend-bounded material source-shell batch. */
const readPublishedMaterialShellBatch = Effect.fn(
  "NakafaMaterial.readPublishedShellBatch"
)(function* (
  locale: Locale,
  sourceCandidates: readonly MaterialSourceCandidate[],
  expectedActiveReleaseId: MaterialReleasePin | undefined
) {
  const result = yield* readRuntimeQuery("contentRelease.material.shell", () =>
    fetchRuntimeQuery(api.contentRelease.material.shell, {
      ...(expectedActiveReleaseId === undefined
        ? {}
        : { expectedActiveReleaseId }),
      locale,
      sourceCandidates: Array.from(sourceCandidates),
    })
  );
  const identity = { locale, publicPath: "materials" };
  const [activeReleaseId, claims, materials] = yield* Effect.all([
    decodeMaterialReleasePin(
      result.activeReleaseId,
      expectedActiveReleaseId,
      identity
    ),
    decodeMaterialClaims(result.sourceClaims, sourceCandidates, identity),
    decodeMaterialSources(
      result.sourceProjectionJson,
      sourceCandidates,
      identity
    ),
  ]);
  return {
    activeReleaseId,
    model: { claims, materials } satisfies MaterialSourceModel,
  };
});
