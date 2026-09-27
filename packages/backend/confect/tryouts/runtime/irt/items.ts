import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { TryoutResponseIntegrityError } from "@repo/backend/confect/tryouts/response/spec";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { Effect } from "effect";

type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutPlacement = Docs["tryoutAttemptPlacements"];

/** One exact IRT scale plus items validated against immutable placements. */
export interface TryoutIrtSource {
  readonly items: readonly {
    readonly item: Docs["irtScaleItems"];
    readonly placementId: TryoutPlacement["_id"];
  }[];
  readonly scale: Docs["irtScaleVersions"];
}

/** Loads the complete frozen IRT source once for terminal attempt scoring. */
export const loadAttemptIrtSource = Effect.fn(
  "tryouts.runtime.loadAttemptIrtSource"
)(function* (attempt: TryoutAttempt, placements: readonly TryoutPlacement[]) {
  const scale = yield* loadAttemptScale(attempt);
  const items = yield* loadAttemptScaleItems(scale, placements);
  return {
    items,
    scale,
  };
});

/** Loads one section through its exact scale-owned calibration run. */
export const loadSectionIrtSource = Effect.fn(
  "tryouts.runtime.loadSectionIrtSource"
)(function* (args: {
  readonly attempt: TryoutAttempt;
  readonly placements: readonly TryoutPlacement[];
  readonly sectionIdentity: string;
}) {
  const database = yield* DatabaseReader;
  const scale = yield* loadAttemptScale(args.attempt);
  const runs = yield* database
    .table("irtCalibrationRuns")
    .index("by_scaleVersionId_and_sectionIdentity_and_startedAt", (query) =>
      query
        .eq("scaleVersionId", scale._id)
        .eq("sectionIdentity", args.sectionIdentity)
    )
    .take(2)
    .pipe(Effect.mapError(toTryoutRuntimeError));
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
  const items = yield* database
    .table("irtScaleItems")
    .index("by_calibrationRunId", (query) =>
      query.eq("calibrationRunId", run._id)
    )
    .take(args.placements.length + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
  const validatedItems = yield* validateIrtScaleItems({
    items,
    placements: args.placements,
    scale,
  });
  return {
    items: validatedItems,
    scale,
  };
});

/** Loads the exact signed IRT scale frozen by one attempt. */
const requireIrtScaleVersion = Effect.fn(
  "tryouts.runtime.requireIrtScaleVersion"
)(function* (attempt: TryoutAttempt) {
  const database = yield* DatabaseReader;
  const scaleVersionId = attempt.scaleVersionId;
  if (!scaleVersionId) {
    return yield* irtRuntimeError(
      "TRYOUT_IRT_SCALE_REQUIRED",
      "Attempt IRT scale is missing for this try-out."
    );
  }
  const scale = yield* database
    .table("irtScaleVersions")
    .get(scaleVersionId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.mapError(toTryoutRuntimeError)
    );
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
  function* (attempt: TryoutAttempt) {
    const scale = yield* requireIrtScaleVersion(attempt);
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
  scale: Docs["irtScaleVersions"],
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
  scale: Docs["irtScaleVersions"],
  placements: readonly TryoutPlacement[]
) {
  const database = yield* DatabaseReader;
  const items = yield* database
    .table("irtScaleItems")
    .index("by_scaleVersionId_and_placementIdentity", (query) =>
      query.eq("scaleVersionId", scale._id)
    )
    .take(placements.length + 1)
    .pipe(Effect.mapError(toTryoutRuntimeError));
  return yield* validateIrtScaleItems({
    items,
    placements,
    scale,
  });
});

/** Verifies exact one-to-one scale item coverage for immutable placements. */
const validateIrtScaleItems = Effect.fn(
  "tryouts.runtime.validateIrtScaleItems"
)(function* (args: {
  readonly items: readonly Docs["irtScaleItems"][];
  readonly placements: readonly TryoutPlacement[];
  readonly scale: Docs["irtScaleVersions"];
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
      return yield* new TryoutResponseIntegrityError({
        code: "TRYOUT_PLACEMENT_DUPLICATE",
        message: "Try-out placement has a duplicate immutable identity.",
      });
    }
    placementsByIdentity.set(placement.placementIdentity, placement);
  }
  const itemIdentities = new Set<string>();
  const validated: TryoutIrtSource["items"][number][] = [];
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
        item.placementRowHash === placement.placementRowHash
      )
    ) {
      return yield* irtRuntimeError(
        "TRYOUT_IRT_ITEM_STALE",
        "IRT scale item is missing or stale for one try-out question."
      );
    }
    itemIdentities.add(item.placementIdentity);
    validated.push({
      item,
      placementId: placement._id,
    });
  }
  return validated;
});

/** Creates one stable typed IRT runtime failure. */
function irtRuntimeError(code: TryoutRuntimeError["code"], message: string) {
  return new TryoutRuntimeError({
    code,
    message,
  });
}
