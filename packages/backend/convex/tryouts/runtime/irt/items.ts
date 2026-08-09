import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutPlacement = Doc<"tryoutAttemptPlacements">;

/** One exact IRT scale plus items validated against immutable placements. */
export interface TryoutIrtSource {
  readonly items: Doc<"irtScaleItems">[];
  readonly scale: Doc<"irtScaleVersions">;
}

/** Loads the complete frozen IRT source once for terminal attempt scoring. */
export const loadAttemptIrtSource = Effect.fn(
  "tryouts.runtime.loadAttemptIrtSource"
)(function* (
  ctx: MutationCtx,
  attempt: TryoutAttempt,
  placements: TryoutPlacement[]
) {
  const scale = yield* loadAttemptScale(ctx, attempt);
  const items = yield* loadAttemptScaleItems(ctx, scale, placements);

  return { items, scale };
});

/** Loads one section through its exact scale-owned calibration run. */
export const loadSectionIrtSource = Effect.fn(
  "tryouts.runtime.loadSectionIrtSource"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly placements: TryoutPlacement[];
    readonly sectionIdentity: string;
  }
) {
  const scale = yield* loadAttemptScale(ctx, args.attempt);
  const runs = yield* tryRuntimePromise(() =>
    ctx.db
      .query("irtCalibrationRuns")
      .withIndex(
        "by_scaleVersionId_and_sectionIdentity_and_startedAt",
        (query) =>
          query
            .eq("scaleVersionId", scale._id)
            .eq("sectionIdentity", args.sectionIdentity)
      )
      .take(2)
  );
  const run = runs[0];
  if (
    runs.length !== 1 ||
    !run ||
    run.model !== scale.model ||
    run.questionCount !== args.placements.length ||
    run.status !== "completed"
  ) {
    return yield* irtRuntimeError(
      "TRYOUT_IRT_CALIBRATION_RUN_MISMATCH",
      "IRT calibration run does not match the frozen section."
    );
  }

  const items = yield* tryRuntimePromise(() =>
    ctx.db
      .query("irtScaleItems")
      .withIndex("by_calibrationRunId", (query) =>
        query.eq("calibrationRunId", run._id)
      )
      .take(args.placements.length + 1)
  );
  const validatedItems = yield* validateIrtScaleItems({
    items,
    placements: args.placements,
    scale,
  });

  return { items: validatedItems, scale };
});

/** Loads the exact signed IRT scale frozen by one attempt. */
const requireIrtScaleVersion = Effect.fn(
  "tryouts.runtime.requireIrtScaleVersion"
)(function* (ctx: MutationCtx, attempt: TryoutAttempt) {
  const scaleVersionId = attempt.scaleVersionId;
  if (!scaleVersionId) {
    return yield* irtRuntimeError(
      "TRYOUT_IRT_SCALE_REQUIRED",
      "Attempt IRT scale is missing for this try-out."
    );
  }
  const scale = yield* tryRuntimePromise(() => ctx.db.get(scaleVersionId));
  if (scale && scaleBelongsToAttempt(scale, attempt)) {
    return scale;
  }
  return yield* irtRuntimeError(
    "TRYOUT_IRT_SCALE_REQUIRED",
    "Attempt IRT scale is missing for this try-out."
  );
});

/** Loads and validates the scale version frozen by one attempt. */
const loadAttemptScale = Effect.fn("tryouts.runtime.loadAttemptScale")(
  function* (ctx: MutationCtx, attempt: TryoutAttempt) {
    const scale = yield* requireIrtScaleVersion(ctx, attempt);

    if (scale.questionCount !== attempt.totalQuestions) {
      return yield* irtRuntimeError(
        "TRYOUT_IRT_SCALE_COUNT_MISMATCH",
        "IRT scale question count does not match the attempt."
      );
    }

    return scale;
  }
);

/** Verifies one frozen scale belongs to the same signed attempt snapshot. */
function scaleBelongsToAttempt(
  scale: Doc<"irtScaleVersions">,
  attempt: TryoutAttempt
) {
  return (
    scale.setIdentity === attempt.setIdentity &&
    scale.tryoutSnapshotId === attempt.tryoutSnapshotId
  );
}

/** Loads every item in the attempt's complete scale snapshot. */
const loadAttemptScaleItems = Effect.fn(
  "tryouts.runtime.loadAttemptScaleItems"
)(function* (
  ctx: MutationCtx,
  scale: Doc<"irtScaleVersions">,
  placements: TryoutPlacement[]
) {
  const items = yield* tryRuntimePromise(() =>
    ctx.db
      .query("irtScaleItems")
      .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
        query.eq("scaleVersionId", scale._id)
      )
      .take(placements.length + 1)
  );

  return yield* validateIrtScaleItems({ items, placements, scale });
});

/** Verifies exact one-to-one scale item coverage for immutable placements. */
const validateIrtScaleItems = Effect.fn(
  "tryouts.runtime.validateIrtScaleItems"
)(function* (args: {
  readonly items: Doc<"irtScaleItems">[];
  readonly placements: TryoutPlacement[];
  readonly scale: Doc<"irtScaleVersions">;
}) {
  if (args.items.length !== args.placements.length) {
    return yield* irtRuntimeError(
      "TRYOUT_IRT_ITEM_COUNT_MISMATCH",
      "IRT scale item count does not match the placement inventory."
    );
  }

  const placementsByIdentity = new Map<string, TryoutPlacement>();
  for (const placement of args.placements) {
    if (placementsByIdentity.has(placement.placementIdentity)) {
      return yield* irtRuntimeError(
        "TRYOUT_PLACEMENT_DUPLICATE",
        "Try-out placement has a duplicate immutable identity."
      );
    }
    placementsByIdentity.set(placement.placementIdentity, placement);
  }

  const itemIdentities = new Set<string>();
  for (const item of args.items) {
    if (itemIdentities.has(item.placementIdentity)) {
      return yield* irtRuntimeError(
        "TRYOUT_IRT_ITEM_DUPLICATE",
        "IRT scale contains a duplicate placement item."
      );
    }

    const placement = placementsByIdentity.get(item.placementIdentity);
    if (
      !(
        placement &&
        item.scaleVersionId === args.scale._id &&
        matchesPlacementSnapshot(item, placement)
      )
    ) {
      return yield* irtRuntimeError(
        "TRYOUT_IRT_ITEM_STALE",
        "IRT scale item is missing or stale for one try-out question."
      );
    }

    itemIdentities.add(item.placementIdentity);
  }

  return args.items;
});

/** Verifies that an IRT item belongs to the exact placed source snapshot. */
export function matchesPlacementSnapshot(
  item: Doc<"irtScaleItems">,
  placement: TryoutPlacement
) {
  return (
    item.placementIdentity === placement.placementIdentity &&
    item.placementRowHash === placement.placementRowHash
  );
}

/** Creates one stable typed IRT runtime failure. */
function irtRuntimeError(code: string, message: string) {
  return new TryoutRuntimeError({ code, message });
}
