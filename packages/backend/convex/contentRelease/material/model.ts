import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import {
  readVisibleMaterial,
  resolveMaterialRoute,
} from "@repo/backend/convex/contentRelease/material/route";
import { resolveMaterialSourceModel } from "@repo/backend/convex/contentRelease/material/source";
import type { MaterialSourceCandidate } from "@repo/backend/convex/contentRelease/material/spec";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { requireExpectedActiveRelease } from "@repo/backend/convex/contentRelease/runtime/pin";
import { Effect } from "effect";

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
    sourceCandidates: readonly MaterialSourceCandidate[] = [],
    expectedActiveReleaseId?: string | null
  ) {
    const route = yield* resolveMaterialRoute(ctx, locale, publicPath);
    yield* requireExpectedActiveRelease(
      route.active,
      expectedActiveReleaseId,
      "Material route"
    );
    const { sourceClaims, sourceProjectionJson } =
      yield* resolveMaterialSourceModel(
        ctx,
        locale,
        route.active,
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
        sourceProjectionJson,
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
        sourceProjectionJson,
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
      sourceProjectionJson,
      sourceRevision: readSourceRevision(route.active),
    };
  }
);
