import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { verifyMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import { loadContentOwner } from "@repo/backend/convex/contentRelease/scope/owner";
import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

interface ActiveMaterialIdentity {
  readonly releaseId: string;
  readonly sequence: number;
}

/** Loads the current exact material owner for one stable content identity. */
const loadStoredOwner = Effect.fn("contentRelease.loadStoredMaterialOwner")(
  function* (ctx: MutationCtx, contentKey: string, locale: ContentLocale) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("materialOwners")
        .withIndex("by_contentKey_and_locale", (index) =>
          index.eq("contentKey", contentKey).eq("locale", locale)
        )
        .unique()
    );
  }
);

/** Reconciles one material identity against active immutable ownership. */
export const syncExactMaterialOwner = Effect.fn(
  "contentRelease.syncExactMaterialOwner"
)(function* (
  ctx: MutationCtx,
  contentKey: string,
  locale: ContentLocale,
  active: ActiveMaterialIdentity
) {
  const [owner, stored] = yield* Effect.all([
    loadContentOwner(ctx, contentKey, locale, active.sequence),
    loadStoredOwner(ctx, contentKey, locale),
  ]);
  if (owner && owner.family !== "material") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Material ${contentKey}/${locale} changed ownership family.`
    );
  }
  if (!owner?.managed) {
    if (stored) {
      yield* Effect.promise(() => ctx.db.delete("materialOwners", stored._id));
    }
    return;
  }
  const row = {
    contentKey,
    locale,
    releaseId: active.releaseId,
    sequence: active.sequence,
  };
  if (stored) {
    yield* Effect.promise(() =>
      ctx.db.replace("materialOwners", stored._id, row)
    );
    return;
  }
  yield* Effect.promise(() => ctx.db.insert("materialOwners", row));
});

/** Loads the bounded current exact material ownership projection. */
export const loadExactMaterialOwners = Effect.fn(
  "contentRelease.loadExactMaterialOwners"
)(function* (
  ctx: QueryCtx,
  active: ActiveMaterialIdentity,
  locale?: ContentLocale
) {
  const rows = yield* Effect.promise(() => {
    if (locale === undefined) {
      return ctx.db
        .query("materialOwners")
        .withIndex("by_releaseId_and_locale_and_contentKey", (index) =>
          index.eq("releaseId", active.releaseId)
        )
        .take(EXACT_SCOPE_LIMIT + 1);
    }
    return ctx.db
      .query("materialOwners")
      .withIndex("by_releaseId_and_locale_and_contentKey", (index) =>
        index.eq("releaseId", active.releaseId).eq("locale", locale)
      )
      .take(EXACT_SCOPE_LIMIT + 1);
  });
  if (rows.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Active release ${active.releaseId} exceeds ${EXACT_SCOPE_LIMIT} exact material owners.`
    );
  }
  if (rows.some((row) => row.sequence !== active.sequence)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active release ${active.releaseId} has stale exact material owners.`
    );
  }
  return rows;
});

/** Finalizes one bounded exact material owner snapshot after model sync. */
export const finalizeExactMaterialOwners = Effect.fn(
  "contentRelease.finalizeExactMaterialOwners"
)(function* (
  ctx: MutationCtx,
  release: Pick<
    Doc<"contentReleases">,
    "releaseId" | "resultFamilies" | "sequence"
  >
) {
  const stored = yield* Effect.promise(() =>
    ctx.db.query("materialOwners").take(EXACT_SCOPE_LIMIT + 1)
  );
  if (stored.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Active material ownership exceeds ${EXACT_SCOPE_LIMIT} exact identities.`
    );
  }
  if (release.resultFamilies.includes("material")) {
    for (const owner of stored) {
      yield* Effect.promise(() => ctx.db.delete("materialOwners", owner._id));
    }
    return;
  }
  const transitions = yield* Effect.promise(() =>
    ctx.db
      .query("contentOwners")
      .withIndex("by_releaseId_and_contentKey_and_locale", (index) =>
        index.eq("releaseId", release.releaseId)
      )
      .take(EXACT_SCOPE_LIMIT + 1)
  );
  if (transitions.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Release ${release.releaseId} exceeds ${EXACT_SCOPE_LIMIT} exact ownership transitions.`
    );
  }
  const ownersByIdentity = new Map(
    [...stored, ...transitions].map(({ contentKey, locale }) => [
      `${locale}\0${contentKey}`,
      { contentKey, locale },
    ])
  );
  for (const owner of ownersByIdentity.values()) {
    yield* syncExactMaterialOwner(ctx, owner.contentKey, owner.locale, release);
  }
  const finalized = yield* Effect.promise(() =>
    ctx.db.query("materialOwners").take(EXACT_SCOPE_LIMIT + 1)
  );
  if (finalized.length > EXACT_SCOPE_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Active material ownership exceeds ${EXACT_SCOPE_LIMIT} exact identities.`
    );
  }
});

/** Reads bounded exact owners and every visible selected material. */
export const readExactMaterialSnapshot = Effect.fn(
  "contentRelease.readExactMaterialSnapshot"
)(function* (
  ctx: QueryCtx,
  active: ActiveMaterialIdentity,
  locale?: ContentLocale
) {
  const owners = yield* loadExactMaterialOwners(ctx, active, locale);
  const materials = yield* Effect.forEach(owners, (owner) =>
    Effect.gen(function* () {
      const projection = yield* resolvePublicProjection(
        ctx,
        owner.contentKey,
        owner.locale,
        active.sequence
      );
      if (!projection) {
        return null;
      }
      if (projection.family !== "material") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Exact material ${owner.contentKey}/${owner.locale} resolved a different family.`
        );
      }
      const row = yield* Effect.promise(() =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_contentKey_and_locale", (index) =>
            index.eq("contentKey", owner.contentKey).eq("locale", owner.locale)
          )
          .unique()
      );
      if (!row) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Exact material ${owner.contentKey}/${owner.locale} lost its catalog row.`
        );
      }
      const verified = yield* verifyMaterial(row);
      if (
        row.projectionHash !== projection.projectionHash ||
        row.projectionJson !== projection.projectionJson ||
        row.publicPath !== projection.publicPath ||
        row.releaseId !== projection.releaseId ||
        row.rendererDomain !== projection.rendererDomain ||
        row.sequence !== projection.sequence ||
        row.sourcePath !== projection.sourcePath
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Exact material ${owner.contentKey}/${owner.locale} disagrees with its published projection.`
        );
      }
      return { ...verified, row };
    })
  );
  return {
    materials: materials.filter((material) => material !== null),
    owners,
  };
});
