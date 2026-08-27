import type { TryoutHistoryMigrationAttemptInventory } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Private domains for the signed set and its per-attempt audit entries. */
export const TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN =
  "nakafa.tryout-history.attempt-inventory";
const TRYOUT_HISTORY_ATTEMPT_ENTRY_DOMAIN =
  "nakafa.tryout-history.attempt-entry";

/** Complete private bytes that must be unchanged before one atomic migration. */
export interface TryoutHistoryAttemptInventoryEntry {
  readonly attempt: Doc<"tryoutAttempts">;
  readonly marker: Doc<"tryoutAttemptHistory">;
  readonly placements: readonly Doc<"tryoutAttemptPlacements">[];
  readonly progress: Doc<"tryoutSetProgress"> | null;
  readonly responses: readonly Doc<"tryoutResponses">[];
  readonly score: Doc<"tryoutScores"> | null;
  readonly sections: readonly Doc<"tryoutSectionAttempts">[];
}

/** Sorts Convex identities before canonical private serialization. */
function byId(left: { readonly _id: string }, right: { readonly _id: string }) {
  return left._id.localeCompare(right._id);
}

/** Selects only attempt-owned bytes that remain immutable during planning. */
function authorizationEntry(entry: TryoutHistoryAttemptInventoryEntry) {
  const { attempt, marker, placements, responses, score, sections } = entry;
  return { attempt, marker, placements, responses, score, sections };
}

/** Reads every attempt-owned document without exposing it outside the backend. */
export const readTryoutHistoryAttemptEntry = Effect.fn(
  "tryouts.migration.readAttemptEntry"
)(function* (ctx: ReadCtx, marker: Doc<"tryoutAttemptHistory">) {
  const attempt = yield* Effect.promise(() =>
    ctx.db.get(marker.tryoutAttemptId)
  );
  if (!attempt) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained history marker lost its attempt."
    );
  }
  if (
    !Number.isSafeInteger(attempt.totalQuestions) ||
    attempt.totalQuestions < 0 ||
    attempt.totalQuestions > retainedTryoutHistoryPlan.frozenPlacementCount ||
    attempt.sectionSnapshots.length > attempt.totalQuestions ||
    attempt.sectionSnapshots.length >
      retainedTryoutHistoryPlan.frozenPlacementCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained history attempt declared an invalid inventory bound."
    );
  }
  const { placements, progress, responses, score, sections } =
    yield* Effect.all({
      placements: Effect.promise(() =>
        ctx.db
          .query("tryoutAttemptPlacements")
          .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
            query.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.totalQuestions + 1)
      ),
      progress: Effect.promise(() =>
        ctx.db
          .query("tryoutSetProgress")
          .withIndex("by_userId_and_setIdentity", (query) =>
            query
              .eq("userId", attempt.userId)
              .eq("setIdentity", attempt.setIdentity)
          )
          .unique()
      ),
      responses: Effect.promise(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutAttemptId_and_answeredAt", (query) =>
            query.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.totalQuestions + 1)
      ),
      score: Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (query) =>
            query.eq("tryoutAttemptId", attempt._id)
          )
          .unique()
      ),
      sections: Effect.promise(() =>
        ctx.db
          .query("tryoutSectionAttempts")
          .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
            query.eq("tryoutAttemptId", attempt._id)
          )
          .take(attempt.sectionSnapshots.length + 1)
      ),
    });
  return {
    attempt,
    marker,
    placements: placements.sort(byId),
    progress: progress?.latestAttemptId === attempt._id ? progress : null,
    responses: responses.sort(byId),
    score,
    sections: sections.sort(byId),
  } satisfies TryoutHistoryAttemptInventoryEntry;
});

/** Reads the complete ordered private source set and its aggregate counts. */
export const readTryoutHistoryAttemptInventory = Effect.fn(
  "tryouts.migration.readAttemptInventory"
)(function* (ctx: ReadCtx) {
  const markers = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttemptHistory")
      .take(retainedTryoutHistoryPlan.attemptCount + 1)
  );
  const entries = yield* Effect.forEach(
    markers.sort(byId),
    (marker) => readTryoutHistoryAttemptEntry(ctx, marker),
    { concurrency: 1 }
  );
  return {
    attemptCount: entries.length,
    entries,
    frozenPlacementCount: entries.reduce(
      (count, entry) => count + entry.placements.length,
      0
    ),
    inventoryJson: JSON.stringify(entries.map(authorizationEntry)),
    progressCount: entries.filter(({ progress }) => progress !== null).length,
    responseCount: entries.reduce(
      (count, entry) => count + entry.responses.length,
      0
    ),
    scoreCount: entries.filter(({ score }) => score !== null).length,
    sectionAttemptCount: entries.reduce(
      (count, entry) => count + entry.sections.length,
      0
    ),
  };
});

/** Hashes one private entry for its temporary per-attempt authorization row. */
export function hashTryoutHistoryAttemptEntry(
  entry: TryoutHistoryAttemptInventoryEntry
) {
  return hashText(
    "retained try-out attempt entry",
    `${TRYOUT_HISTORY_ATTEMPT_ENTRY_DOMAIN}\n${JSON.stringify(
      authorizationEntry(entry)
    )}`
  );
}

/** Rechecks all private attempt bytes and aggregate counts against the plan. */
export const verifyTryoutHistoryAttemptInventory = Effect.fn(
  "tryouts.migration.verifyAttemptInventory"
)(function* (ctx: ReadCtx, expected: TryoutHistoryMigrationAttemptInventory) {
  const inventory = yield* readTryoutHistoryAttemptInventory(ctx);
  const digest = yield* hashText(
    "retained try-out attempt inventory",
    `${TRYOUT_HISTORY_ATTEMPT_INVENTORY_DOMAIN}\n${inventory.inventoryJson}`
  );
  if (
    digest !== expected.digest ||
    inventory.attemptCount !== expected.attemptCount ||
    inventory.frozenPlacementCount !== expected.frozenPlacementCount ||
    inventory.responseCount !== expected.responseCount ||
    inventory.scoreCount !== expected.scoreCount ||
    inventory.sectionAttemptCount !== expected.sectionAttemptCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained try-out attempt bytes changed after authorization."
    );
  }
  return inventory;
});
