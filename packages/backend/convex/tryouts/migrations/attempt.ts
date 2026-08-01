import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  bindLegacySection,
  bindLegacySet,
  requireTryoutSnapshot,
} from "@repo/backend/convex/tryouts/migrations/catalog";
import {
  hasMigrationConflict,
  migrationFail,
  migrationPageOptions,
  migrationPageResult,
  type TryoutMigrationArgs,
  tryoutMigrationArgs,
  validateMigrationPage,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

/** Prepares one bounded page of attempt roots. */
const migrateAttemptPage = Effect.fn("tryouts.migrations.migrateAttemptPage")(
  function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
    yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .paginate(migrationPageOptions(args.paginationOpts))
    );
    const processed = yield* validateMigrationPage({
      expectedProcessed: args.expectedProcessed,
      expectedTotal: args.expectedTotal,
      numItems: args.paginationOpts.numItems,
      page,
      table: "tryoutAttempts",
    });
    let changed = 0;
    for (const row of page.page) {
      const patch = yield* prepareAttempt(ctx, args.expectedSnapshotId, row);
      if (!patch) {
        continue;
      }
      changed += 1;
      if (args.apply) {
        yield* Effect.promise(() => ctx.db.patch(row._id, patch));
      }
    }
    return migrationPageResult(page, changed, processed);
  }
);

/** Adds signed set and section identities while retaining legacy references. */
const prepareAttempt = Effect.fn("tryouts.migrations.prepareAttempt")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    attempt: Doc<"tryoutAttempts">
  ) {
    if (!attempt.tryoutSetId) {
      return yield* migrationFail("An attempt lost its legacy set reference.");
    }
    const set = yield* bindLegacySet(
      ctx,
      expectedSnapshotId,
      attempt.tryoutSetId
    );
    if (
      hasMigrationConflict(attempt.tryoutSnapshotId, expectedSnapshotId) ||
      hasMigrationConflict(attempt.setIdentity, set.identity)
    ) {
      return yield* migrationFail(
        "An attempt conflicts with its signed snapshot identity."
      );
    }
    const sectionSnapshots: Doc<"tryoutAttempts">["sectionSnapshots"] = [];
    for (const snapshot of attempt.sectionSnapshots) {
      if (!(snapshot.tryoutSectionId && snapshot.questionSetId)) {
        return yield* migrationFail(
          "An attempt section lost its legacy references."
        );
      }
      const section = yield* bindLegacySection(
        ctx,
        expectedSnapshotId,
        snapshot.tryoutSectionId
      );
      const mismatch = legacySnapshotMismatch(snapshot, section.legacy);
      if (mismatch) {
        return yield* migrationFail(
          `An attempt section differs at ${mismatch}.`
        );
      }
      const signedMismatch = signedSnapshotMismatch(snapshot, section);
      if (signedMismatch) {
        return yield* migrationFail(
          `An attempt section differs at ${signedMismatch}.`
        );
      }
      if (
        snapshot.sectionIdentity === section.identity &&
        snapshot.sectionRowHash === section.rowHash
      ) {
        sectionSnapshots.push(snapshot);
        continue;
      }
      sectionSnapshots.push({
        ...snapshot,
        sectionIdentity: section.identity,
        sectionRowHash: section.rowHash,
      });
    }
    const questionCount = sectionSnapshots.reduce(
      (total, snapshot) => total + snapshot.questionCount,
      0
    );
    if (
      questionCount !== attempt.totalQuestions ||
      questionCount !== set.row.questionCount
    ) {
      return yield* migrationFail(
        "An attempt question count differs from its signed set."
      );
    }
    if (
      attempt.tryoutSnapshotId === expectedSnapshotId &&
      attempt.setIdentity === set.identity &&
      attempt.countryKey === set.row.countryKey &&
      attempt.examKey === set.row.examKey &&
      attempt.trackKey === set.row.trackKey &&
      attempt.setKey === set.row.setKey &&
      attempt.locale === set.row.locale &&
      attempt.sectionSnapshots.every(
        (snapshot, index) =>
          snapshot.sectionIdentity ===
            sectionSnapshots[index]?.sectionIdentity &&
          snapshot.sectionRowHash === sectionSnapshots[index]?.sectionRowHash
      )
    ) {
      return null;
    }
    return {
      countryKey: set.row.countryKey,
      examKey: set.row.examKey,
      locale: set.row.locale,
      sectionSnapshots,
      setIdentity: set.identity,
      setKey: set.row.setKey,
      trackKey: set.row.trackKey,
      tryoutSnapshotId: expectedSnapshotId,
    };
  }
);

/** Finds a conflicting signed identity already attached to one snapshot. */
function signedSnapshotMismatch(
  snapshot: Doc<"tryoutAttempts">["sectionSnapshots"][number],
  section: Effect.Effect.Success<ReturnType<typeof bindLegacySection>>
) {
  if (
    snapshot.sectionIdentity !== undefined &&
    snapshot.sectionIdentity !== section.identity
  ) {
    return "sectionIdentity";
  }
  if (
    snapshot.sectionRowHash !== undefined &&
    snapshot.sectionRowHash !== section.rowHash
  ) {
    return "sectionRowHash";
  }
  return;
}

/** Finds the first frozen-section field that differs from its source row. */
function legacySnapshotMismatch(
  snapshot: Doc<"tryoutAttempts">["sectionSnapshots"][number],
  section: Doc<"tryoutSections">
) {
  if (snapshot.questionSourcePath !== section.questionSourcePath) {
    return `questionSourcePath (${snapshot.questionSourcePath} != ${section.questionSourcePath})`;
  }
  const pairs = [
    {
      field: "publicPath",
      frozen: snapshot.publicPath,
      source: section.publicPath,
    },
    {
      field: "questionCount",
      frozen: snapshot.questionCount,
      source: section.questionCount,
    },
    {
      field: "questionSetId",
      frozen: snapshot.questionSetId,
      source: section.questionSetId,
    },
    {
      field: "sectionKey",
      frozen: snapshot.sectionKey,
      source: section.sectionKey,
    },
    {
      field: "sectionOrder",
      frozen: snapshot.sectionOrder,
      source: section.order,
    },
    {
      field: "sourceRevision",
      frozen: snapshot.sourceRevision,
      source: section.sourceRevision,
    },
    {
      field: "timeLimitSeconds",
      frozen: snapshot.timeLimitSeconds,
      source: section.timeLimitSeconds,
    },
    {
      field: "tryoutSectionId",
      frozen: snapshot.tryoutSectionId,
      source: section._id,
    },
  ];
  return pairs.find(({ frozen, source }) => frozen !== source)?.field;
}

/** Migrates one bounded attempt-root page. */
export const migrateAttempts = internalMutation({
  args: tryoutMigrationArgs,
  handler: (ctx, args) => runConvexProgram(migrateAttemptPage(ctx, args)),
});
