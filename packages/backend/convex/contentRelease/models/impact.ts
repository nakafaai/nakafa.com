import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

interface ReadModelImpact {
  readonly article: boolean;
  readonly material: boolean;
  readonly search: boolean;
}

/** Checks whether a release may change one authored content family. */
function changesFamily(scope: PublicationScope, family: ContentFamily) {
  return (
    scope.families.includes(family) ||
    scope.content.some((identity) => identity.family === family)
  );
}

/** Derives the read models whose source data may change under one exact scope. */
export function getReadModelImpact(scope: PublicationScope): ReadModelImpact {
  const article = changesFamily(scope, "article");
  const material = changesFamily(scope, "material");
  return {
    article,
    material,
    search: article || material,
  };
}

/**
 * Transfers ownership for read models whose source families are unchanged.
 *
 * Page and question content plus structured snapshots have their own runtime
 * models, so they cannot change article, material, or public-search rows.
 */
export const claimUnchangedReadModels = Effect.fn(
  "contentRelease.claimUnchangedReadModels"
)(function* (
  ctx: MutationCtx,
  release: Doc<"contentReleases">,
  signed: SignedContentRelease,
  state: Doc<"contentState">
) {
  const impact = getReadModelImpact(signed.manifest.scope);
  if (impact.article && impact.material && impact.search) {
    return state;
  }

  const now = Date.now();
  const completedIndex = signed.manifest.itemCount - 1;
  let claimedState = state;

  if (!impact.article) {
    const articleState = {
      articleManifestHash: signed.manifestHash,
      articleReleaseId: release.releaseId,
      articleSequence: release.sequence,
      updatedAt: now,
    };
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        articleIndex: completedIndex,
        articleSyncedAt: now,
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, articleState)
    );
    claimedState = { ...claimedState, ...articleState };
  }

  if (!impact.material) {
    const materialState = {
      materialManifestHash: signed.manifestHash,
      materialReleaseId: release.releaseId,
      materialSequence: release.sequence,
      updatedAt: now,
    };
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        materialIndex: completedIndex,
        materialSyncedAt: now,
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, materialState)
    );
    claimedState = { ...claimedState, ...materialState };
  }

  if (!impact.search) {
    const searchState = {
      searchManifestHash: signed.manifestHash,
      searchReleaseId: release.releaseId,
      searchSequence: release.sequence,
      updatedAt: now,
    };
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        searchIndex: completedIndex,
        searchSyncedAt: now,
        updatedAt: now,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentState", state._id, searchState)
    );
    claimedState = { ...claimedState, ...searchState };
  }

  return claimedState;
});
