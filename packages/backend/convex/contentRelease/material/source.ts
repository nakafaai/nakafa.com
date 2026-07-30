import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  MATERIAL_GROUP_LIMIT,
  MATERIAL_SOURCE_GROUP_LIMIT,
  MATERIAL_SOURCE_LIMIT,
} from "@repo/backend/convex/contentRelease/material/limits";
import {
  loadMaterialCatalogOwner,
  requireMaterialState,
} from "@repo/backend/convex/contentRelease/material/owner";
import { readVisibleMaterial } from "@repo/backend/convex/contentRelease/material/route";
import type {
  MaterialSourceCandidate,
  MaterialSourceClaim,
} from "@repo/backend/convex/contentRelease/material/spec";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { Effect, Schema } from "effect";

/** Produces one stable identity for duplicate source-candidate checks. */
function sourceIdentity(candidate: MaterialSourceCandidate) {
  return `${candidate.locale}\0${candidate.contentKey}`;
}

/** Decodes and bounds source candidates before querying active ownership. */
const decodeSourceCandidates = Effect.fn(
  "contentRelease.decodeMaterialSourceCandidates"
)(function* (candidates: readonly MaterialSourceCandidate[]) {
  if (candidates.length > MATERIAL_SOURCE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material source shell exceeds ${MATERIAL_SOURCE_LIMIT} identities.`
    );
  }
  const identities = new Set(candidates.map(sourceIdentity));
  if (identities.size !== candidates.length) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Material source shell repeats one content identity."
    );
  }
  return yield* Effect.forEach(candidates, (candidate) =>
    Effect.all({
      contentKey: Schema.decodeUnknown(ContentKeySchema)(candidate.contentKey),
      locale: Effect.succeed(candidate.locale),
      parentPath:
        candidate.parentPath === undefined
          ? Effect.succeed(undefined)
          : Schema.decodeUnknown(PublicPathSchema)(candidate.parentPath),
    }).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Material source shell has an invalid identity for ${candidate.contentKey}.`,
          })
      )
    )
  );
});

type DecodedSourceCandidate = Effect.Effect.Success<
  ReturnType<typeof decodeSourceCandidates>
>[number];
type MaterialCatalogOwner = Effect.Effect.Success<
  ReturnType<typeof loadMaterialCatalogOwner>
>;
type ActiveIdentity = Exclude<MaterialCatalogOwner["active"], null>;
type VisibleMaterial = Exclude<
  Effect.Effect.Success<ReturnType<typeof readVisibleMaterial>>,
  null
>;

/** Requires one batched caller to keep reading the same active release. */
const requireExpectedRelease = Effect.fn(
  "contentRelease.requireExpectedMaterialRelease"
)(function* (
  active: ActiveIdentity | null,
  expectedActiveReleaseId: string | null | undefined
) {
  const activeReleaseId = active?.releaseId ?? null;
  if (
    expectedActiveReleaseId !== undefined &&
    activeReleaseId !== expectedActiveReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Material source shell expected active release ${expectedActiveReleaseId ?? "none"} but found ${activeReleaseId ?? "none"}.`
    );
  }
  return activeReleaseId;
});

/** Reconciles decoded source identities claimed by active exact ownership. */
const resolveSourceClaims = Effect.fn(
  "contentRelease.resolveMaterialSourceClaims"
)(function* (
  ctx: QueryCtx,
  active: ActiveIdentity | null,
  familyManaged: boolean,
  candidates: readonly DecodedSourceCandidate[]
) {
  if (familyManaged || !active) {
    return [];
  }
  const claims = yield* Effect.forEach(candidates, (candidate) =>
    Effect.gen(function* () {
      const owner = yield* loadContentOwner(
        ctx,
        candidate.contentKey,
        candidate.locale,
        active.sequence
      );
      if (!owner?.managed) {
        return null;
      }
      if (owner.family !== "material") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Material source ${candidate.contentKey}/${candidate.locale} changed ownership family.`
        );
      }
      yield* requireMaterialState(active, candidate.locale);
      const projection = yield* resolvePublicProjection(
        ctx,
        candidate.contentKey,
        candidate.locale,
        active.sequence
      );
      if (!projection) {
        return {
          contentKey: candidate.contentKey,
          kind: "missing",
          locale: candidate.locale,
        } satisfies MaterialSourceClaim;
      }
      if (projection.family !== "material") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Material source ${candidate.contentKey}/${candidate.locale} resolved a non-material projection.`
        );
      }
      return {
        contentKey: candidate.contentKey,
        kind: "found",
        locale: candidate.locale,
        projectionJson: projection.projectionJson,
      } satisfies MaterialSourceClaim;
    })
  );
  return claims.filter((claim) => claim !== null);
});

/** Reads exact active claims for one bounded source-owned material set. */
export const readMaterialClaims = Effect.fn(
  "contentRelease.readMaterialSourceClaims"
)(function* (
  ctx: QueryCtx,
  candidates: readonly MaterialSourceCandidate[],
  expectedActiveReleaseId?: string | null
) {
  const [catalog, decoded] = yield* Effect.all([
    loadMaterialCatalogOwner(ctx),
    decodeSourceCandidates(candidates),
  ]);
  const activeReleaseId = yield* requireExpectedRelease(
    catalog.active,
    expectedActiveReleaseId
  );
  const sourceClaims = yield* resolveSourceClaims(
    ctx,
    catalog.active,
    catalog.familyManaged,
    decoded
  );
  return { activeReleaseId, sourceClaims };
});

/** Reads exact-owned projections sharing one temporary source shell. */
const readSourceMaterials = Effect.fn(
  "contentRelease.readMaterialSourceMaterials"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"materialCatalog">["locale"],
  familyManaged: boolean,
  candidates: readonly DecodedSourceCandidate[]
) {
  if (familyManaged) {
    return [];
  }
  const parentPaths = new Set(
    candidates.flatMap((candidate) =>
      candidate.locale === locale && candidate.parentPath
        ? [candidate.parentPath]
        : []
    )
  );
  if (parentPaths.size > MATERIAL_SOURCE_GROUP_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Material source shell exceeds ${MATERIAL_SOURCE_GROUP_LIMIT} lesson groups.`
    );
  }
  const groups = yield* Effect.forEach(parentPaths, (parentPath) =>
    Effect.gen(function* () {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("materialCatalog")
          .withIndex(
            "by_locale_and_parentPath_and_order_and_publicPath",
            (index) => index.eq("locale", locale).eq("parentPath", parentPath)
          )
          .take(MATERIAL_GROUP_LIMIT + 1)
      );
      if (rows.length > MATERIAL_GROUP_LIMIT) {
        return yield* releaseFail(
          "CONTENT_RELEASE_LIMIT",
          `Material ${locale}/${parentPath} exceeds ${MATERIAL_GROUP_LIMIT} lesson sections.`
        );
      }
      return yield* Effect.forEach(rows, (row) =>
        readVisibleMaterial(ctx, row, familyManaged)
      );
    })
  );
  const visible = new Map<string, VisibleMaterial>();
  for (const material of groups.flat()) {
    if (material) {
      visible.set(
        `${material.row.locale}\0${material.row.contentKey}`,
        material
      );
    }
  }
  return Array.from(visible.values());
});

/** Resolves claims and exact group rows for one decoded source shell. */
export const resolveMaterialSourceModel = Effect.fn(
  "contentRelease.resolveMaterialSourceModel"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"materialCatalog">["locale"],
  active: ActiveIdentity | null,
  familyManaged: boolean,
  candidates: readonly MaterialSourceCandidate[]
) {
  const decoded = yield* decodeSourceCandidates(candidates);
  const [sourceClaims, sourceMaterials] = yield* Effect.all([
    resolveSourceClaims(ctx, active, familyManaged, decoded),
    readSourceMaterials(ctx, locale, familyManaged, decoded),
  ]);
  return {
    sourceClaims,
    sourceProjectionJson: sourceMaterials.map(
      ({ projectionJson }) => projectionJson
    ),
  };
});

/** Reads one bounded exact overlay for temporary source-owned material rows. */
export const readMaterialShell = Effect.fn(
  "contentRelease.readMaterialSourceModel"
)(function* (
  ctx: QueryCtx,
  locale: Doc<"materialCatalog">["locale"],
  candidates: readonly MaterialSourceCandidate[],
  expectedActiveReleaseId?: string | null
) {
  const catalog = yield* loadMaterialCatalogOwner(ctx);
  const activeReleaseId = yield* requireExpectedRelease(
    catalog.active,
    expectedActiveReleaseId
  );
  const model = yield* resolveMaterialSourceModel(
    ctx,
    locale,
    catalog.active,
    catalog.familyManaged,
    candidates
  );
  return { activeReleaseId, ...model };
});
