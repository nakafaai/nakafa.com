import type { TryoutHistoryMigrationPlanPayload } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  type CleanupKind,
  type CleanupPage,
  type CleanupState,
  cleanupKinds,
} from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { Effect } from "effect";

interface CleanupBounds {
  readonly maximum: number;
  readonly minimum: number;
}

/** Derives the authenticated row bounds for one deletion category. */
function cleanupBounds(
  plan: TryoutHistoryMigrationPlanPayload,
  kind: CleanupKind
): CleanupBounds {
  switch (kind) {
    case "scaleItem":
      return {
        maximum: plan.source.scales.itemCount,
        minimum: plan.source.scales.itemCount,
      };
    case "scaleRun":
      return {
        maximum: plan.source.scales.runCount,
        minimum: plan.source.scales.runCount,
      };
    case "scale":
    case "scaleMap":
      return {
        maximum: plan.source.scales.versionCount,
        minimum: plan.source.scales.versionCount,
      };
    case "history": {
      const count = plan.source.catalogRowCount + plan.source.placementRowCount;
      return { maximum: count, minimum: count };
    }
    case "catalog":
      return {
        maximum: plan.source.catalogRowCount,
        minimum: plan.source.catalogRowCount,
      };
    case "placement":
      return {
        maximum: plan.source.placementRowCount,
        minimum: plan.source.placementRowCount,
      };
    case "legacy":
      return {
        maximum: plan.source.legacyBundleCount,
        minimum: plan.source.legacyBundleCount,
      };
    case "runtime":
      return {
        maximum: plan.source.runtimeBundleCount,
        minimum: plan.source.runtimeBundleCount,
      };
    case "snapshot":
      return { maximum: 1, minimum: 1 };
    case "audit":
      return {
        maximum: plan.source.attempts.attemptCount,
        minimum: plan.source.attempts.attemptCount,
      };
    case "artifact":
      return {
        maximum: plan.target.artifacts.count * 2,
        minimum: plan.target.artifacts.count,
      };
    case "catalogMap":
      return {
        maximum: plan.target.catalog.count,
        minimum: plan.target.catalog.count,
      };
    case "placementMap":
      return {
        maximum: plan.target.placements.count,
        minimum: plan.target.placements.count,
      };
    default:
      return kind satisfies never;
  }
}

function isSafeCount(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Creates the zeroed monotonic counter stored before the first deletion. */
export function initialCleanupState(startedAt: number): CleanupState {
  return {
    counts: {
      artifact: 0,
      audit: 0,
      catalog: 0,
      catalogMap: 0,
      history: 0,
      legacy: 0,
      placement: 0,
      placementMap: 0,
      runtime: 0,
      scale: 0,
      scaleItem: 0,
      scaleMap: 0,
      scaleRun: 0,
      snapshot: 0,
    },
    kind: cleanupKinds[0],
    startedAt,
  };
}

/** Rejects corrupted, over-budget, or non-monotonic persisted counters. */
export const requireCleanupState = Effect.fn(
  "tryouts.migration.requireCleanupState"
)(function* (state: CleanupState, plan: TryoutHistoryMigrationPlanPayload) {
  if (!isSafeCount(state.startedAt)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup has an invalid start time."
    );
  }
  const activeIndex = cleanupKinds.indexOf(state.kind);
  for (const [index, kind] of cleanupKinds.entries()) {
    const count = state.counts[kind];
    const bounds = cleanupBounds(plan, kind);
    if (
      !isSafeCount(count) ||
      count > bounds.maximum ||
      (index < activeIndex && count < bounds.minimum) ||
      (index > activeIndex && count !== 0)
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out history cleanup has invalid ${kind} cardinality.`
      );
    }
  }
  return state;
});

/** Adds one page only when all earlier signed categories are complete. */
export const recordCleanupPage = Effect.fn(
  "tryouts.migration.recordCleanupPage"
)(function* (
  state: CleanupState,
  plan: TryoutHistoryMigrationPlanPayload,
  page: CleanupPage
) {
  yield* requireCleanupState(state, plan);
  if (!Number.isSafeInteger(page.deleted) || page.deleted <= 0) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup returned an invalid page size."
    );
  }
  const activeIndex = cleanupKinds.indexOf(state.kind);
  const pageIndex = cleanupKinds.indexOf(page.kind);
  if (pageIndex < activeIndex) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup moved backward across source categories."
    );
  }
  for (let index = activeIndex; index < pageIndex; index += 1) {
    const kind = cleanupKinds[index];
    const bounds = cleanupBounds(plan, kind);
    if (state.counts[kind] < bounds.minimum) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out history cleanup skipped incomplete ${kind} rows.`
      );
    }
  }
  const nextCount = state.counts[page.kind] + page.deleted;
  const bounds = cleanupBounds(plan, page.kind);
  if (!isSafeCount(nextCount) || nextCount > bounds.maximum) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out history cleanup exceeded signed ${page.kind} cardinality.`
    );
  }
  const next = {
    counts: { ...state.counts, [page.kind]: nextCount },
    kind: page.kind,
    startedAt: state.startedAt,
  } satisfies CleanupState;
  yield* requireCleanupState(next, plan);
  return next;
});

/** Sums every validated category without requiring terminal completion. */
export const countCleanupRows = Effect.fn("tryouts.migration.countCleanupRows")(
  function* (state: CleanupState, plan: TryoutHistoryMigrationPlanPayload) {
    yield* requireCleanupState(state, plan);
    let deleted = 0;
    for (const kind of cleanupKinds) {
      deleted += state.counts[kind];
    }
    if (!Number.isSafeInteger(deleted)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history cleanup produced an invalid cumulative count."
      );
    }
    return deleted;
  }
);

/** Returns the exact deleted total only after every category is complete. */
export const requireCleanupComplete = Effect.fn(
  "tryouts.migration.requireCleanupComplete"
)(function* (state: CleanupState, plan: TryoutHistoryMigrationPlanPayload) {
  const deleted = yield* countCleanupRows(state, plan);
  for (const kind of cleanupKinds) {
    const count = state.counts[kind];
    const bounds = cleanupBounds(plan, kind);
    if (count < bounds.minimum || count > bounds.maximum) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out history cleanup did not prove ${kind} cardinality.`
      );
    }
  }
  return deleted;
});
