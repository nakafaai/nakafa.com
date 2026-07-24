import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  StableTryoutPlacement,
  StableTryoutSet,
} from "@repo/backend/convex/tryouts/snapshot/spec";
import {
  identityFailure,
  type TryoutIdentityPhase,
  type TryoutIdentityReceipt,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

/** Reads one required legacy set without hiding orphaned durable state. */
export const requireSet = Effect.fn("tryouts.migrations.requireSet")(function* (
  ctx: MutationCtx,
  setId: Doc<"tryoutSets">["_id"]
) {
  const set = yield* Effect.promise(() => ctx.db.get(setId));
  if (!set) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_SET_ORPHANED",
      `Legacy set ${setId} does not exist.`
    );
  }
  return set;
});

/** Verifies an exact bounded table count before changing a migration page. */
export const exactRows = Effect.fn("tryouts.migrations.exactRows")(function* <
  Row,
>(
  read: () => Promise<Row[]>,
  expectedRows: number,
  phase: TryoutIdentityPhase
) {
  const rows = yield* Effect.promise(read);
  if (rows.length !== expectedRows) {
    return yield* identityFailure(
      "TRYOUT_IDENTITY_COUNT_MISMATCH",
      `Phase ${phase} expected ${expectedRows} rows but found ${rows.length}.`
    );
  }
  return rows;
});

/** Rejects partially migrated or conflicting attempt identity state. */
export function validateAttemptState(
  attempt: Doc<"tryoutAttempts">,
  snapshotId: string,
  stable: StableTryoutSet
) {
  const values = [
    [attempt.tryoutSnapshotId, snapshotId],
    [attempt.setIdentity, stable.identity],
    [attempt.countryKey, stable.countryKey],
    [attempt.examKey, stable.examKey],
    [attempt.trackKey, stable.trackKey],
    [attempt.setKey, stable.setKey],
    [attempt.locale, stable.locale],
  ] as const;
  if (
    values.some(
      ([current, expected]) => current !== undefined && current !== expected
    )
  ) {
    return identityFailure(
      "TRYOUT_IDENTITY_ATTEMPT_CONFLICT",
      `Attempt ${attempt._id} has conflicting stable identity state.`
    );
  }
  if (
    values.some(([current]) => current !== undefined) &&
    values.some(([current]) => current === undefined)
  ) {
    return identityFailure(
      "TRYOUT_IDENTITY_ATTEMPT_PARTIAL",
      `Attempt ${attempt._id} has incomplete stable identity state.`
    );
  }
  return null;
}

/** Requires a child row to inherit one fully migrated attempt root. */
export function requireStableAttempt(
  attempt: Doc<"tryoutAttempts">,
  snapshotId: string,
  stable: StableTryoutSet
) {
  const stateError = validateAttemptState(attempt, snapshotId, stable);
  if (stateError) {
    return stateError;
  }
  if (attempt.tryoutSnapshotId === undefined) {
    return identityFailure(
      "TRYOUT_IDENTITY_ATTEMPT_REQUIRED",
      `Attempt ${attempt._id} must be migrated before its child rows.`
    );
  }
  return null;
}

/** Rejects partially migrated or conflicting placement identity state. */
export function validatePlacementState(
  placement: Doc<"tryoutAttemptPlacements">,
  sectionKey: string,
  stable: StableTryoutPlacement
) {
  const values = [
    [placement.placementIdentity, stable.identity],
    [placement.placementRowHash, stable.rowHash],
    [placement.sectionKey, sectionKey],
    [placement.questionContentKey, stable.row.questionContentKey],
    [placement.questionArtifactHash, stable.row.questionArtifactHash],
    [placement.answerContentKey, stable.row.answerContentKey],
    [placement.answerArtifactHash, stable.row.answerArtifactHash],
    [placement.rendererDomain, stable.row.rendererDomain],
  ] as const;
  if (
    values.some(
      ([current, expected]) => current !== undefined && current !== expected
    )
  ) {
    return identityFailure(
      "TRYOUT_IDENTITY_PLACEMENT_CONFLICT",
      `Placement ${placement._id} has conflicting stable identity state.`
    );
  }
  if (
    values.some(([current]) => current !== undefined) &&
    values.some(([current]) => current === undefined)
  ) {
    return identityFailure(
      "TRYOUT_IDENTITY_PLACEMENT_PARTIAL",
      `Placement ${placement._id} has incomplete stable identity state.`
    );
  }
  return null;
}

/** Builds the stable receipt for one Convex pagination response. */
export function identityReceipt(
  rowCount: number,
  page: { continueCursor: string; isDone: boolean; page: readonly unknown[] },
  candidates: number,
  updated: number
): TryoutIdentityReceipt {
  return {
    candidates,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    processed: Math.min(page.page.length, rowCount),
    updated,
  };
}
