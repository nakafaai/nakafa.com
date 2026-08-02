import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireTryoutSnapshot } from "@repo/backend/convex/tryouts/migrations/catalog";
import { bindLegacyPlacement } from "@repo/backend/convex/tryouts/migrations/question";
import {
  hasMigrationConflict,
  migrationFail,
  migrationPageOptions,
  migrationPageResult,
  type TryoutMigrationArgs,
  tryoutMigrationArgs,
  tryoutMigrationResultValidator,
  validateMigrationPage,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

/** Prepares one bounded page of frozen attempt placements. */
const migratePlacementPage = Effect.fn(
  "tryouts.migrations.migratePlacementPage"
)(function* (ctx: MutationCtx, args: TryoutMigrationArgs) {
  yield* requireTryoutSnapshot(ctx, args.expectedSnapshotId);
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttemptPlacements")
      .paginate(migrationPageOptions(args.paginationOpts))
  );
  const processed = yield* validateMigrationPage({
    expectedProcessed: args.expectedProcessed,
    expectedTotal: args.expectedTotal,
    numItems: args.paginationOpts.numItems,
    page,
    table: "tryoutAttemptPlacements",
  });
  let changed = 0;
  for (const row of page.page) {
    const patch = yield* preparePlacement(ctx, args.expectedSnapshotId, row);
    if (!patch) {
      continue;
    }
    changed += 1;
    if (args.apply) {
      yield* Effect.promise(() => ctx.db.patch(row._id, patch));
    }
  }
  return migrationPageResult(page, changed, processed);
});

/** Adds signed artifacts and stable identities to one legacy placement. */
const preparePlacement = Effect.fn("tryouts.migrations.preparePlacement")(
  function* (
    ctx: MutationCtx,
    expectedSnapshotId: string,
    placement: Doc<"tryoutAttemptPlacements">
  ) {
    const signed = yield* bindLegacyPlacement(
      ctx,
      expectedSnapshotId,
      placement
    );
    if (hasPlacementConflict(placement, signed)) {
      return yield* migrationFail(
        "A placement conflicts with its signed artifact identity."
      );
    }
    if (
      placement.answerArtifactHash === signed.row.answerArtifactHash &&
      placement.answerContentKey === signed.row.answerContentKey &&
      placement.placementIdentity === signed.identity &&
      placement.placementRowHash === signed.rowHash &&
      placement.questionArtifactHash === signed.row.questionArtifactHash &&
      placement.questionContentKey === signed.row.questionContentKey &&
      placement.rendererDomain === signed.row.rendererDomain &&
      placement.sectionIdentity === signed.sectionIdentity &&
      placement.sectionKey === signed.row.sectionKey
    ) {
      return null;
    }
    return {
      answerArtifactHash: signed.row.answerArtifactHash,
      answerContentKey: signed.row.answerContentKey,
      placementIdentity: signed.identity,
      placementRowHash: signed.rowHash,
      questionArtifactHash: signed.row.questionArtifactHash,
      questionContentKey: signed.row.questionContentKey,
      rendererDomain: signed.row.rendererDomain,
      sectionIdentity: signed.sectionIdentity,
      sectionKey: signed.row.sectionKey,
    };
  }
);

/** Detects any conflicting signed field already attached to one placement. */
function hasPlacementConflict(
  placement: Doc<"tryoutAttemptPlacements">,
  signed: Effect.Effect.Success<ReturnType<typeof bindLegacyPlacement>>
) {
  return (
    hasMigrationConflict(
      placement.answerArtifactHash,
      signed.row.answerArtifactHash
    ) ||
    hasMigrationConflict(
      placement.answerContentKey,
      signed.row.answerContentKey
    ) ||
    hasMigrationConflict(placement.placementIdentity, signed.identity) ||
    hasMigrationConflict(placement.placementRowHash, signed.rowHash) ||
    hasMigrationConflict(
      placement.questionArtifactHash,
      signed.row.questionArtifactHash
    ) ||
    hasMigrationConflict(
      placement.questionContentKey,
      signed.row.questionContentKey
    ) ||
    hasMigrationConflict(placement.rendererDomain, signed.row.rendererDomain) ||
    hasMigrationConflict(placement.sectionIdentity, signed.sectionIdentity) ||
    hasMigrationConflict(placement.sectionKey, signed.row.sectionKey)
  );
}

/** Migrates one bounded attempt-placement page. */
export const migratePlacements = internalMutation({
  args: tryoutMigrationArgs,
  returns: tryoutMigrationResultValidator,
  handler: (ctx, args) => runConvexProgram(migratePlacementPage(ctx, args)),
});
