import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  ARTICLE_DATE_CUTOVER_LIMIT,
  type ArticleDateCutoverCounts,
  type ArticleDateCutoverIdentity,
  type ArticleDateCutoverReceipt,
  type ArticleDateCutoverRequest,
  type ArticleDateCutoverStatus,
} from "@repo/backend/convex/contentRelease/article/cutover/spec";
import { readArticleDates } from "@repo/backend/convex/contentRelease/article/dates";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import { Clock, Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type ArticleRow = Doc<"articleCatalog">;
type CurrentArticleRow = Extract<ArticleRow, { datePublished: string }>;

/** Requires one idle publication state at the caller's exact active identity. */
const loadCutoverIdentity = Effect.fn(
  "contentRelease.article.cutover.loadIdentity"
)(function* (ctx: ReadCtx, expected: ArticleDateCutoverRequest) {
  const state = yield* loadState(ctx);
  if (
    !state ||
    state.activeManifestHash !== expected.expectedManifestHash ||
    state.activeReleaseId !== expected.expectedReleaseId ||
    state.activeSequence !== expected.expectedSequence ||
    state.articleManifestHash !== expected.expectedManifestHash ||
    state.articleReleaseId !== expected.expectedReleaseId ||
    state.articleSequence !== expected.expectedSequence
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Article date cutover does not own the exact active article release."
    );
  }
  if (
    state.candidateManifestHash !== undefined ||
    state.candidateReleaseId !== undefined ||
    state.candidateSequence !== undefined ||
    state.recoveryManifestHash !== undefined ||
    state.recoveryReleaseId !== undefined ||
    state.recoverySequence !== undefined
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Article date cutover requires empty candidate and recovery slots."
    );
  }
  return {
    manifestHash: state.activeManifestHash,
    releaseId: state.activeReleaseId,
    sequence: state.activeSequence,
  } satisfies ArticleDateCutoverIdentity;
});

/** Reads the complete small article catalog or fails before any write. */
const loadCutoverRows = Effect.fn("contentRelease.article.cutover.loadRows")(
  function* (ctx: ReadCtx) {
    const rows = yield* Effect.promise(() =>
      ctx.db.query("articleCatalog").take(ARTICLE_DATE_CUTOVER_LIMIT + 1)
    );
    if (rows.length > ARTICLE_DATE_CUTOVER_LIMIT) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Article date cutover exceeds ${ARTICLE_DATE_CUTOVER_LIMIT} rows.`
      );
    }
    return rows;
  }
);

/** Validates every date pair before classifying the transition state. */
const classifyRows = Effect.fn("contentRelease.article.cutover.classifyRows")(
  function* (rows: readonly ArticleRow[]) {
    yield* Effect.forEach(rows, readArticleDates);
    let currentOnly = 0;
    let dual = 0;
    let legacyOnly = 0;
    for (const row of rows) {
      if (!("datePublished" in row)) {
        legacyOnly += 1;
      } else if (row.date === undefined) {
        currentOnly += 1;
      } else {
        dual += 1;
      }
    }
    return {
      currentOnly,
      dual,
      legacyOnly,
      total: rows.length,
    } satisfies ArticleDateCutoverCounts;
  }
);

/** Loads one identity-bound, fully validated migration snapshot. */
const loadCutover = Effect.fn("contentRelease.article.cutover.load")(function* (
  ctx: ReadCtx,
  expected: ArticleDateCutoverRequest
) {
  const active = yield* loadCutoverIdentity(ctx, expected);
  const rows = yield* loadCutoverRows(ctx);
  const counts = yield* classifyRows(rows);
  return { active, counts, rows };
});

/** Refuses to guess a publication date for an unconverted legacy row. */
const requireCurrentDates = Effect.fn(
  "contentRelease.article.cutover.requireCurrentDates"
)(function* (rows: readonly ArticleRow[], counts: ArticleDateCutoverCounts) {
  if (counts.legacyOnly > 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Article date cutover found rows without datePublished."
    );
  }
  return rows.filter((row): row is CurrentArticleRow => "datePublished" in row);
});

/** Returns the exact current storage shape without deriving transient time. */
export const readArticleDateCutover = Effect.fn(
  "contentRelease.article.cutover.status"
)(function* (ctx: ReadCtx, expected: ArticleDateCutoverRequest) {
  const { active, counts } = yield* loadCutover(ctx, expected);
  return { active, counts } satisfies ArticleDateCutoverStatus;
});

/** Removes the bridge date atomically after all rows prove current dates. */
export const removeLegacyArticleDates = Effect.fn(
  "contentRelease.article.cutover.remove"
)(function* (ctx: MutationCtx, expected: ArticleDateCutoverRequest) {
  const { active, counts, rows } = yield* loadCutover(ctx, expected);
  const currentRows = yield* requireCurrentDates(rows, counts);
  for (const row of currentRows) {
    if (row.date !== undefined) {
      yield* Effect.promise(() =>
        ctx.db.patch("articleCatalog", row._id, { date: undefined })
      );
    }
  }
  const executedAt = yield* Clock.currentTimeMillis;
  return {
    active,
    changed: counts.dual,
    counts: {
      currentOnly: counts.total,
      dual: 0,
      legacyOnly: 0,
      total: counts.total,
    },
    executedAt,
    operation: "remove",
    unchanged: counts.currentOnly,
  } satisfies ArticleDateCutoverReceipt;
});

/** Restores the exact bridge value for rollback before strict contraction. */
export const restoreLegacyArticleDates = Effect.fn(
  "contentRelease.article.cutover.restore"
)(function* (ctx: MutationCtx, expected: ArticleDateCutoverRequest) {
  const { active, counts, rows } = yield* loadCutover(ctx, expected);
  const currentRows = yield* requireCurrentDates(rows, counts);
  for (const row of currentRows) {
    if (row.date === undefined) {
      yield* Effect.promise(() =>
        ctx.db.patch("articleCatalog", row._id, {
          date: row.datePublished,
        })
      );
    }
  }
  const executedAt = yield* Clock.currentTimeMillis;
  return {
    active,
    changed: counts.currentOnly,
    counts: {
      currentOnly: 0,
      dual: counts.total,
      legacyOnly: 0,
      total: counts.total,
    },
    executedAt,
    operation: "restore",
    unchanged: counts.dual,
  } satisfies ArticleDateCutoverReceipt;
});
