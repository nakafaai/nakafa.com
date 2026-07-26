import { ContentLocaleSchema } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { MATERIAL_GROUP_LIMIT } from "@repo/backend/convex/contentRelease/material/limits";
import { loadMaterialOwner } from "@repo/backend/convex/contentRelease/material/owner";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { Effect } from "effect";

/** Reads every locale-specific counterpart for one stable material identity. */
const readAlternates = Effect.fn("contentRelease.readMaterialAlternates")(
  function* (ctx: QueryCtx, row: Doc<"materialCatalog">) {
    return yield* Effect.forEach(ContentLocaleSchema.literals, (locale) =>
      Effect.gen(function* () {
        const alternate = yield* Effect.promise(() =>
          ctx.db
            .query("materialCatalog")
            .withIndex("by_contentKey_and_locale", (index) =>
              index.eq("contentKey", row.contentKey).eq("locale", locale)
            )
            .unique()
        );
        if (!alternate) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            `Material ${row.contentKey} lost locale ${locale}.`
          );
        }
        return yield* verifyMaterial(alternate);
      })
    );
  }
);

/** Reads every ordered lesson section sharing one localized material key. */
const readSiblings = Effect.fn("contentRelease.readMaterialSiblings")(
  function* (ctx: QueryCtx, row: Doc<"materialCatalog">) {
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
    const verified = yield* Effect.forEach(siblings, verifyMaterial);
    if (
      !siblings.some(({ _id }) => _id === row._id) ||
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
    publicPath: string
  ) {
    const owner = yield* loadMaterialOwner(ctx, locale);
    if (!(owner.managed && owner.active)) {
      return {
        activeManifestHash: owner.active?.manifestHash ?? null,
        activeReleaseId: owner.active?.releaseId ?? null,
        alternateJson: [],
        managed: false,
        projectionJson: null,
        rendererDomain: null,
        siblingJson: [],
        sourceRevision: null,
      };
    }
    const row = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", locale).eq("publicPath", publicPath)
        )
        .unique()
    );
    if (!row) {
      return {
        activeManifestHash: owner.active.manifestHash,
        activeReleaseId: owner.active.releaseId,
        alternateJson: [],
        managed: true,
        projectionJson: null,
        rendererDomain: null,
        siblingJson: [],
        sourceRevision: readSourceRevision(owner.active),
      };
    }
    const [current, alternates, siblings] = yield* Effect.all([
      verifyMaterial(row),
      readAlternates(ctx, row),
      readSiblings(ctx, row),
    ]);
    return {
      activeManifestHash: owner.active.manifestHash,
      activeReleaseId: owner.active.releaseId,
      alternateJson: alternates.map(({ projectionJson }) => projectionJson),
      managed: true,
      projectionJson: current.projectionJson,
      rendererDomain: row.rendererDomain,
      siblingJson: siblings.map(({ projectionJson }) => projectionJson),
      sourceRevision: readSourceRevision(owner.active),
    };
  }
);
