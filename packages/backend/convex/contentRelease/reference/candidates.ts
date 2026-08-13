import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import type { ContentReferenceInput } from "@repo/backend/convex/contentRelease/reference/spec";
import { findTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { Effect, Option } from "effect";

export type ContentReferenceCandidate =
  | { readonly family: "article"; readonly row: Doc<"articleCatalog"> }
  | { readonly family: "material"; readonly row: Doc<"materialCatalog"> }
  | {
      readonly family: "materialTopic";
      readonly row: Doc<"materialCatalog">;
    }
  | {
      readonly family: "quran";
      readonly row: Doc<"quranSearch">;
      readonly snapshotId: string;
    }
  | {
      readonly family: "tryout";
      readonly row: Doc<"tryoutCatalog">;
      readonly snapshotId: string;
    };

interface CandidateRows {
  readonly article: readonly Doc<"articleCatalog">[];
  readonly material: readonly Doc<"materialCatalog">[];
  readonly materialTopic: Doc<"materialCatalog"> | null;
  readonly quran: readonly Doc<"quranSearch">[];
  readonly quranSnapshotId: string | null;
  readonly tryout: readonly Doc<"tryoutCatalog">[];
  readonly tryoutSnapshotId: string | null;
}

/** Selects at most one current signed family through exact storage indexes. */
export const selectContentReferenceCandidate = Effect.fn(
  "contentRelease.selectContentReferenceCandidate"
)(function* (ctx: QueryCtx, input: ContentReferenceInput) {
  const owners = yield* Effect.all({
    quran: loadQuranOwner(ctx),
    tryout: findTryoutOwner(ctx),
  });
  const quranSnapshotId = owners.quran.snapshotId;
  const tryoutSnapshotId = Option.isSome(owners.tryout)
    ? String(owners.tryout.value.snapshotId)
    : null;
  const rows = yield* input.kind === "route"
    ? readRouteCandidates(ctx, input, quranSnapshotId, tryoutSnapshotId)
    : readContentCandidates(ctx, input, quranSnapshotId, tryoutSnapshotId);
  return yield* chooseCandidate(rows);
});

/** Probes one route in each family without scanning unrelated rows. */
const readRouteCandidates = Effect.fn(
  "contentRelease.readRouteReferenceCandidates"
)(function* (
  ctx: QueryCtx,
  input: Extract<ContentReferenceInput, { readonly kind: "route" }>,
  quranSnapshotId: string | null,
  tryoutSnapshotId: string | null
) {
  const rows = yield* Effect.all({
    article: Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", input.locale).eq("publicPath", input.publicPath)
        )
        .take(2)
    ),
    material: Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_locale_and_publicPath", (index) =>
          index.eq("locale", input.locale).eq("publicPath", input.publicPath)
        )
        .take(2)
    ),
    materialTopic: Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex(
          "by_locale_and_parentPath_and_order_and_publicPath",
          (index) =>
            index.eq("locale", input.locale).eq("parentPath", input.publicPath)
        )
        .first()
    ),
    quran: readQuranRouteRows(ctx, quranSnapshotId, input),
    tryout: readTryoutRouteRows(ctx, tryoutSnapshotId, input),
  });
  return { ...rows, quranSnapshotId, tryoutSnapshotId };
});

/** Probes one graph asset in each family without parsing its identity grammar. */
const readContentCandidates = Effect.fn(
  "contentRelease.readGraphReferenceCandidates"
)(function* (
  ctx: QueryCtx,
  input: Extract<ContentReferenceInput, { readonly kind: "content" }>,
  quranSnapshotId: string | null,
  tryoutSnapshotId: string | null
) {
  const rows = yield* Effect.all({
    article: Effect.promise(() =>
      ctx.db
        .query("articleCatalog")
        .withIndex("by_assetId", (index) =>
          index.eq("assetId", input.contentId)
        )
        .take(2)
    ),
    material: Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_assetId", (index) =>
          index.eq("assetId", input.contentId)
        )
        .take(2)
    ),
    materialTopic: Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_topicAssetId_and_assetId", (index) =>
          index.eq("topicAssetId", input.contentId)
        )
        .first()
    ),
    quran: readQuranAssetRows(ctx, quranSnapshotId, input.contentId),
    tryout: readTryoutAssetRows(ctx, tryoutSnapshotId, input.contentId),
  });
  return { ...rows, quranSnapshotId, tryoutSnapshotId };
});

/** Rejects duplicate index facts and cross-family identity collisions. */
const chooseCandidate = Effect.fn("contentRelease.chooseReferenceCandidate")(
  function* (rows: CandidateRows) {
    if (rows.article.length > 1) {
      return yield* identityCollision("article");
    }
    if (rows.material.length > 1) {
      return yield* identityCollision("material");
    }
    if (rows.quran.length > 1) {
      return yield* identityCollision("Quran");
    }
    if (rows.tryout.length > 1) {
      return yield* identityCollision("try-out");
    }

    const candidates: ContentReferenceCandidate[] = [];
    const article = rows.article[0];
    if (article) {
      candidates.push({ family: "article", row: article });
    }
    const material = rows.material[0];
    if (material) {
      candidates.push({ family: "material", row: material });
    }
    if (rows.materialTopic) {
      candidates.push({ family: "materialTopic", row: rows.materialTopic });
    }
    const quran = rows.quran[0];
    if (quran) {
      if (!rows.quranSnapshotId) {
        return yield* identityCollision("Quran owner");
      }
      candidates.push({
        family: "quran",
        row: quran,
        snapshotId: rows.quranSnapshotId,
      });
    }
    const tryout = rows.tryout[0];
    if (tryout) {
      if (!rows.tryoutSnapshotId) {
        return yield* identityCollision("try-out owner");
      }
      candidates.push({
        family: "tryout",
        row: tryout,
        snapshotId: rows.tryoutSnapshotId,
      });
    }
    if (candidates.length > 1) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Current content identity resolves more than one signed family."
      );
    }
    return candidates[0] ?? null;
  }
);

function readQuranRouteRows(
  ctx: QueryCtx,
  snapshotId: string | null,
  input: Extract<ContentReferenceInput, { readonly kind: "route" }>
) {
  if (!snapshotId) {
    return Effect.succeed([]);
  }
  return Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("locale", input.locale)
          .eq("publicPath", input.publicPath)
      )
      .take(2)
  );
}

function readTryoutRouteRows(
  ctx: QueryCtx,
  snapshotId: string | null,
  input: Extract<ContentReferenceInput, { readonly kind: "route" }>
) {
  if (!snapshotId) {
    return Effect.succeed([]);
  }
  return Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
        index
          .eq("snapshotId", snapshotId)
          .eq("locale", input.locale)
          .eq("publicPath", input.publicPath)
      )
      .take(2)
  );
}

function readQuranAssetRows(
  ctx: QueryCtx,
  snapshotId: string | null,
  contentId: string
) {
  if (!snapshotId) {
    return Effect.succeed([]);
  }
  return Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withIndex("by_snapshotId_and_assetId", (index) =>
        index.eq("snapshotId", snapshotId).eq("assetId", contentId)
      )
      .take(2)
  );
}

function readTryoutAssetRows(
  ctx: QueryCtx,
  snapshotId: string | null,
  contentId: string
) {
  if (!snapshotId) {
    return Effect.succeed([]);
  }
  return Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_assetId", (index) =>
        index.eq("snapshotId", snapshotId).eq("assetId", contentId)
      )
      .take(2)
  );
}

function identityCollision(family: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Current ${family} identity resolves multiple catalog rows.`
  );
}
