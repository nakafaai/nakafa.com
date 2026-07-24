import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { internalMutation } from "@repo/backend/convex/functions";
import { irtIdentityFail } from "@repo/backend/convex/irt/error";
import {
  type IrtIdentityPatch,
  resolveIrtIdentityPatch,
} from "@repo/backend/convex/irt/identity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { type PaginationOptions, paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const MAX_SCALE_COUNT = 16;
const MAX_RUN_COUNT = 100;
const MAX_ITEM_COUNT = 1000;
export const irtIdentityPageSize = 50;
export const irtIdentityPhases = ["scales", "runs", "items"] as const;
export type IrtIdentityPhase = (typeof irtIdentityPhases)[number];

const phaseValidator = v.union(
  ...irtIdentityPhases.map((phase) => v.literal(phase))
);

const identityMigrationArgs = {
  apply: v.boolean(),
  expectedItemCount: v.number(),
  expectedRunCount: v.number(),
  expectedScaleCount: v.number(),
  paginationOpts: paginationOptsValidator,
  phase: phaseValidator,
  snapshotId: v.string(),
};

const identityMigrationReceipt = v.object({
  applied: v.boolean(),
  candidates: v.number(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  itemCount: v.number(),
  pending: v.number(),
  phase: phaseValidator,
  processed: v.number(),
  remaining: v.number(),
  runCount: v.number(),
  scaleCount: v.number(),
  snapshotId: v.string(),
  updated: v.number(),
});

/** Exact operator-supplied bounds for one live IRT identity migration. */
export interface IrtIdentityMigrationArgs {
  readonly apply: boolean;
  readonly expectedItemCount: number;
  readonly expectedRunCount: number;
  readonly expectedScaleCount: number;
  readonly paginationOpts: PaginationOptions;
  readonly phase: IrtIdentityPhase;
  readonly snapshotId: string;
}

/** Proof returned after validating and optionally applying one bounded page. */
export interface IrtIdentityMigrationReceipt {
  readonly applied: boolean;
  readonly candidates: number;
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly itemCount: number;
  readonly pending: number;
  readonly phase: IrtIdentityPhase;
  readonly processed: number;
  readonly remaining: number;
  readonly runCount: number;
  readonly scaleCount: number;
  readonly snapshotId: string;
  readonly updated: number;
}

/** Rejects unbounded or malformed migration expectations before database IO. */
export const validateIrtIdentityBounds = Effect.fn(
  "irt.validateIdentityBounds"
)(function* (args: IrtIdentityMigrationArgs) {
  const bounds: readonly (readonly [string, number, number])[] = [
    ["scale", args.expectedScaleCount, MAX_SCALE_COUNT],
    ["run", args.expectedRunCount, MAX_RUN_COUNT],
    ["item", args.expectedItemCount, MAX_ITEM_COUNT],
  ];
  yield* Schema.decodeUnknown(Sha256HashSchema)(args.snapshotId).pipe(
    Effect.catchAll(() =>
      irtIdentityFail(
        "IRT identity migration requires one canonical snapshot ID."
      )
    )
  );
  for (const [label, count, maximum] of bounds) {
    if (!Number.isSafeInteger(count) || count < 1 || count > maximum) {
      return yield* irtIdentityFail(
        `IRT identity migration ${label} count must be 1-${maximum}.`
      );
    }
  }
  if (args.paginationOpts.numItems !== irtIdentityPageSize) {
    return yield* irtIdentityFail(
      `IRT identity migration page size must be exactly ${irtIdentityPageSize}.`
    );
  }
});

/** Requires an exact bounded table count before migration planning. */
const requireExactCount = Effect.fn("irt.requireIdentityCount")(function* <A>(
  label: string,
  rows: readonly A[],
  expected: number
) {
  if (rows.length !== expected) {
    return yield* irtIdentityFail(
      `IRT identity migration expected ${expected} ${label}, found ${rows.length}.`
    );
  }
  return rows;
});

/** Reads the complete proven-small IRT graph with one overflow sentinel. */
const loadIrtRows = Effect.fn("irt.loadIdentityRows")(function* (
  ctx: MutationCtx,
  args: IrtIdentityMigrationArgs
) {
  const [scaleRows, itemRows, runRows] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db.query("irtScaleVersions").take(args.expectedScaleCount + 1)
    ),
    Effect.promise(() =>
      ctx.db.query("irtScaleItems").take(args.expectedItemCount + 1)
    ),
    Effect.promise(() =>
      ctx.db.query("irtCalibrationRuns").take(args.expectedRunCount + 1)
    ),
  ]);
  const scales = yield* requireExactCount(
    "scale versions",
    scaleRows,
    args.expectedScaleCount
  );
  const items = yield* requireExactCount(
    "scale items",
    itemRows,
    args.expectedItemCount
  );
  const runs = yield* requireExactCount(
    "calibration runs",
    runRows,
    args.expectedRunCount
  );
  return { items, runs, scales };
});

/** Loads one physical table page without changing its stable ordering. */
const loadIdentityPage = Effect.fn("irt.loadIdentityPage")(function* (
  ctx: MutationCtx,
  args: IrtIdentityMigrationArgs
) {
  if (args.phase === "scales") {
    return yield* Effect.promise(() =>
      ctx.db.query("irtScaleVersions").paginate(args.paginationOpts)
    );
  }
  if (args.phase === "runs") {
    return yield* Effect.promise(() =>
      ctx.db.query("irtCalibrationRuns").paginate(args.paginationOpts)
    );
  }
  return yield* Effect.promise(() =>
    ctx.db.query("irtScaleItems").paginate(args.paginationOpts)
  );
});

/** Requires parent phases to finish before a dependent phase can write. */
const requireCompletedParents = Effect.fn("irt.requireCompletedParents")(
  function* (phase: IrtIdentityPhase, patch: IrtIdentityPatch) {
    if (phase !== "scales" && patch.scalePatches.length > 0) {
      return yield* irtIdentityFail(
        "IRT identity migration must finish scales before dependent rows."
      );
    }
    if (phase === "items" && patch.runPatches.length > 0) {
      return yield* irtIdentityFail(
        "IRT identity migration must finish runs before scale items."
      );
    }
  }
);

/** Returns all pending patches owned by one migration phase. */
function selectPhasePatches(phase: IrtIdentityPhase, patch: IrtIdentityPatch) {
  if (phase === "scales") {
    return patch.scalePatches;
  }
  if (phase === "runs") {
    return patch.runPatches;
  }
  return patch.itemPatches;
}

/** Applies at most one physical page of already verified identity patches. */
const applyIdentityPage = Effect.fn("irt.applyIdentityPage")(function* (
  ctx: MutationCtx,
  args: IrtIdentityMigrationArgs,
  patch: IrtIdentityPatch,
  pageIds: ReadonlySet<string>
) {
  if (!args.apply) {
    return 0;
  }
  if (args.phase === "scales") {
    const rows = patch.scalePatches.filter(({ id }) => pageIds.has(id));
    yield* Effect.forEach(rows, ({ id, ...values }) =>
      Effect.promise(() => ctx.db.patch("irtScaleVersions", id, values))
    );
    return rows.length;
  }
  if (args.phase === "runs") {
    const rows = patch.runPatches.filter(({ id }) => pageIds.has(id));
    yield* Effect.forEach(rows, ({ id, ...values }) =>
      Effect.promise(() => ctx.db.patch("irtCalibrationRuns", id, values))
    );
    return rows.length;
  }
  const rows = patch.itemPatches.filter(({ id }) => pageIds.has(id));
  yield* Effect.forEach(rows, ({ id, ...values }) =>
    Effect.promise(() => ctx.db.patch("irtScaleItems", id, values))
  );
  return rows.length;
});

/**
 * Previews or applies one bounded stable-identity page after validating the
 * complete operator-selected IRT graph.
 */
export const migrateIrtIdentity = Effect.fn("irt.migrateIdentity")(function* (
  ctx: MutationCtx,
  args: IrtIdentityMigrationArgs
) {
  yield* validateIrtIdentityBounds(args);
  const active = yield* loadActiveSnapshot(ctx, "tryout");
  if (!active || active.snapshotId !== args.snapshotId) {
    return yield* irtIdentityFail(
      `Snapshot ${args.snapshotId} is not the verified active try-out snapshot.`
    );
  }
  const rows = yield* loadIrtRows(ctx, args);
  const patch = yield* resolveIrtIdentityPatch(
    ctx,
    args.snapshotId,
    rows.scales,
    rows.items,
    rows.runs
  );
  yield* requireCompletedParents(args.phase, patch);
  const page = yield* loadIdentityPage(ctx, args);
  const pageIds = new Set(page.page.map(({ _id }) => _id));
  const phasePatches = selectPhasePatches(args.phase, patch);
  const candidates = phasePatches.filter(({ id }) => pageIds.has(id)).length;
  const updated = yield* applyIdentityPage(ctx, args, patch, pageIds);
  return {
    applied: args.apply,
    candidates,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    itemCount: rows.items.length,
    pending: phasePatches.length,
    phase: args.phase,
    processed: page.page.length,
    remaining: phasePatches.length - updated,
    runCount: rows.runs.length,
    scaleCount: rows.scales.length,
    snapshotId: args.snapshotId,
    updated,
  } satisfies IrtIdentityMigrationReceipt;
});

/** Internal operator-only boundary for the guarded IRT identity migration. */
export const migrateIdentity = internalMutation({
  args: identityMigrationArgs,
  returns: identityMigrationReceipt,
  handler: (ctx, args) => runConvexProgram(migrateIrtIdentity(ctx, args)),
});
