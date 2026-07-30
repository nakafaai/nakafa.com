import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { resolveMaterialRoute } from "@repo/backend/convex/contentRelease/material/route";
import type {
  MaterialSourceCandidate,
  MaterialSourceClaim,
} from "@repo/backend/convex/contentRelease/material/spec";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { Effect, Schema } from "effect";

const MATERIAL_SOURCE_LIMIT =
  MATERIAL_GROUP_LIMIT + ContentLocaleSchema.literals.length;

/** Produces one stable identity for duplicate source-candidate checks. */
function sourceIdentity(candidate: MaterialSourceCandidate) {
  return `${candidate.locale}\0${candidate.contentKey}`;
}

/** Reconciles source-shell identities claimed by active exact ownership. */
const readSourceClaims = Effect.fn("contentRelease.readMaterialSourceClaims")(
  function* (
    ctx: QueryCtx,
    activeSequence: number | undefined,
    familyManaged: boolean,
    candidates: readonly MaterialSourceCandidate[]
  ) {
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
    if (familyManaged || activeSequence === undefined) {
      return [];
    }
    const claims = yield* Effect.forEach(candidates, (candidate) =>
      Effect.gen(function* () {
        const contentKey = yield* Schema.decodeUnknown(ContentKeySchema)(
          candidate.contentKey
        ).pipe(
          Effect.mapError(
            () =>
              new ReleaseError({
                code: "CONTENT_RELEASE_INTEGRITY",
                message: `Material source shell has invalid content identity ${candidate.contentKey}.`,
              })
          )
        );
        const owner = yield* loadContentOwner(
          ctx,
          contentKey,
          candidate.locale,
          activeSequence
        );
        if (!owner?.managed) {
          return null;
        }
        if (owner.family !== "material") {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Material source ${contentKey}/${candidate.locale} changed ownership family.`
          );
        }
        const projection = yield* resolvePublicProjection(
          ctx,
          contentKey,
          candidate.locale,
          activeSequence
        );
        if (!projection) {
          return {
            contentKey,
            kind: "missing",
            locale: candidate.locale,
          } satisfies MaterialSourceClaim;
        }
        if (projection.family !== "material") {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Material source ${contentKey}/${candidate.locale} resolved a non-material projection.`
          );
        }
        return {
          contentKey,
          kind: "found",
          locale: candidate.locale,
          projectionJson: projection.projectionJson,
        } satisfies MaterialSourceClaim;
      })
    );
    return claims.filter((claim) => claim !== null);
  }
);

/** Selects one catalog row only when its active ownership makes it visible. */
const readVisibleMaterial = Effect.fn("contentRelease.readVisibleMaterial")(
  function* (
    ctx: QueryCtx,
    row: Doc<"materialCatalog">,
    familyManaged: boolean
  ) {
    if (familyManaged) {
      return { ...(yield* verifyMaterial(row)), row };
    }
    const route = yield* resolveMaterialRoute(ctx, row.locale, row.publicPath);
    if (!route.material) {
      return null;
    }
    if (route.material.row._id !== row._id) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${row.locale}/${row.publicPath} resolved a different catalog row.`
      );
    }
    return route.material;
  }
);

/** Reads every locale-specific counterpart for one stable material identity. */
const readAlternates = Effect.fn("contentRelease.readMaterialAlternates")(
  function* (
    ctx: QueryCtx,
    row: Doc<"materialCatalog">,
    familyManaged: boolean
  ) {
    const counterparts = yield* Effect.forEach(
      ContentLocaleSchema.literals,
      (locale) =>
        Effect.gen(function* () {
          const alternate = yield* Effect.promise(() =>
            ctx.db
              .query("materialCatalog")
              .withIndex("by_contentKey_and_locale", (index) =>
                index.eq("contentKey", row.contentKey).eq("locale", locale)
              )
              .unique()
          );
          if (alternate) {
            return yield* readVisibleMaterial(ctx, alternate, familyManaged);
          }
          if (!familyManaged) {
            return null;
          }
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Material ${row.contentKey} lost locale ${locale}.`
          );
        })
    );
    return counterparts.filter((counterpart) => counterpart !== null);
  }
);

/** Reads every ordered lesson section sharing one localized material key. */
const readSiblings = Effect.fn("contentRelease.readMaterialSiblings")(
  function* (
    ctx: QueryCtx,
    row: Doc<"materialCatalog">,
    familyManaged: boolean
  ) {
    const siblings = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex(
          "by_locale_and_materialKey_and_order_and_publicPath",
          (index) =>
            index.eq("locale", row.locale).eq("materialKey", row.materialKey)
        )
        .take(MATERIAL_GROUP_LIMIT + 1)
    );
    if (siblings.length > MATERIAL_GROUP_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Material ${row.locale}/${row.materialKey} exceeds ${MATERIAL_GROUP_LIMIT} lesson sections.`
      );
    }
    const candidates = yield* Effect.forEach(siblings, (sibling) =>
      readVisibleMaterial(ctx, sibling, familyManaged)
    );
    const verified = candidates.filter((candidate) => candidate !== null);
    if (
      !verified.some(({ row: candidate }) => candidate._id === row._id) ||
      verified.some(
        ({ projection }) => projection.parentPath !== row.parentPath
      )
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material ${row.locale}/${row.materialKey} lost its coherent lesson group.`
      );
    }
    return verified;
  }
);

/** Resolves the complete active shell model for one localized material lesson. */
export const readMaterialModel = Effect.fn("contentRelease.readMaterialModel")(
  function* (
    ctx: QueryCtx,
    locale: Doc<"materialCatalog">["locale"],
    publicPath: string,
    sourceCandidates: readonly MaterialSourceCandidate[] = []
  ) {
    const route = yield* resolveMaterialRoute(ctx, locale, publicPath);
    const sourceClaims = yield* readSourceClaims(
      ctx,
      route.active?.sequence,
      route.familyManaged,
      sourceCandidates
    );
    if (!(route.managed && route.active)) {
      return {
        activeManifestHash: route.active?.manifestHash ?? null,
        activeReleaseId: route.active?.releaseId ?? null,
        alternateJson: [],
        familyManaged: false,
        managed: false,
        projectionJson: null,
        rendererDomain: null,
        siblingJson: [],
        sourceClaims,
        sourcePath: null,
        sourceRevision: null,
      };
    }
    if (!route.material) {
      return {
        activeManifestHash: route.active.manifestHash,
        activeReleaseId: route.active.releaseId,
        alternateJson: [],
        familyManaged: route.familyManaged,
        managed: true,
        projectionJson: null,
        rendererDomain: null,
        siblingJson: [],
        sourceClaims,
        sourcePath: null,
        sourceRevision: readSourceRevision(route.active),
      };
    }
    const { projectionJson, row } = route.material;
    const [alternates, siblings] = yield* Effect.all([
      readAlternates(ctx, row, route.familyManaged),
      readSiblings(ctx, row, route.familyManaged),
    ]);
    return {
      activeManifestHash: route.active.manifestHash,
      activeReleaseId: route.active.releaseId,
      alternateJson: alternates.map(({ projectionJson }) => projectionJson),
      familyManaged: route.familyManaged,
      managed: true,
      projectionJson,
      rendererDomain: row.rendererDomain,
      siblingJson: siblings.map(({ projectionJson }) => projectionJson),
      sourceClaims,
      sourcePath: row.sourcePath,
      sourceRevision: readSourceRevision(route.active),
    };
  }
);
