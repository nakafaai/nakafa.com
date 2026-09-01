import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { evaluateTryoutResponse } from "@repo/backend/convex/tryouts/response/evaluation";
import {
  resolvePlacementResponseSpec,
  resolveStoredResponseSelection,
} from "@repo/backend/convex/tryouts/response/legacy";
import { isAttemptPlacementWithinBudget } from "@repo/backend/convex/tryouts/runtime/budget";
import { loadPlacementSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { type DefaultFunctionArgs, makeFunctionReference } from "convex/server";
import { Effect, Schema } from "effect";

const PAGE_ROWS = 50;
const PAGE_BYTES = 4 * 1024 * 1024;

type MigrationMode = "contract" | "hydrate";
type MigrationPhase = "placements" | "responses";

interface MigrationPageArgs extends DefaultFunctionArgs {
  readonly cursor: string | null;
  readonly mode: MigrationMode;
  readonly phase: MigrationPhase;
}

interface MigratedPage {
  readonly continueCursor: string;
  readonly isDone: boolean;
  readonly migrated: number;
  readonly visited: number;
}

const pageReference = makeFunctionReference<
  "mutation",
  MigrationPageArgs,
  null
>("tryouts/response/migrate:page");

/** Expected failure while converting persisted response contracts. */
class TryoutResponseMigrationError
  extends Schema.TaggedError<TryoutResponseMigrationError>()(
    "TryoutResponseMigrationError",
    {
      cause: Schema.optional(Schema.Unknown),
      code: Schema.Literal("TRYOUT_RESPONSE_MIGRATION_INVALID"),
      message: Schema.String,
    }
  )
  implements ConvexTaggedError {}

/** Advances one bounded migration page and schedules remaining work. */
export const migratePage = Effect.fn("tryouts.response.migratePage")(function* (
  ctx: MutationCtx,
  args: MigrationPageArgs
) {
  const result =
    args.phase === "placements"
      ? yield* migratePlacementPage(ctx, args.cursor, args.mode)
      : yield* migrateResponsePage(ctx, args.cursor, args.mode);

  yield* Effect.logInfo("Migrated try-out response contract page", {
    isDone: result.isDone,
    migrated: result.migrated,
    mode: args.mode,
    phase: args.phase,
    visited: result.visited,
  });

  if (!result.isDone) {
    yield* schedulePage(ctx, args.mode, args.phase, result.continueCursor);
    return;
  }
  if (args.phase === "placements") {
    yield* schedulePage(ctx, args.mode, "responses", null);
  }
});

/** Schedules one idempotent page of migration work. */
export const schedulePage = Effect.fn("tryouts.response.scheduleMigrationPage")(
  (
    ctx: MutationCtx,
    mode: MigrationMode,
    phase: MigrationPhase,
    cursor: string | null
  ) =>
    migrationPromise("schedule migration page", () =>
      ctx.scheduler.runAfter(0, pageReference, { cursor, mode, phase })
    )
);

/** Migrates one bounded placement page in the requested rollout direction. */
const migratePlacementPage = Effect.fn("tryouts.response.migratePlacementPage")(
  function* (ctx: MutationCtx, cursor: string | null, mode: MigrationMode) {
    const result = yield* migrationPromise("load placement page", () =>
      ctx.db.query("tryoutAttemptPlacements").paginate({
        cursor,
        maximumBytesRead: PAGE_BYTES,
        maximumRowsRead: PAGE_ROWS,
        numItems: PAGE_ROWS,
      })
    );
    const migrated = yield* Effect.forEach(result.page, (placement) =>
      migratePlacement(ctx, placement, mode)
    );
    return pageResult(result, migrated);
  }
);

/** Hydrates or contracts one placement only after response-definition proof. */
const migratePlacement = Effect.fn("tryouts.response.migratePlacement")(
  function* (
    ctx: MutationCtx,
    placement: Doc<"tryoutAttemptPlacements">,
    mode: MigrationMode
  ) {
    if (mode === "contract" && !placement.responseSpec) {
      return yield* migrationError(
        "Try-out placement has no canonical response definition."
      );
    }
    const responseSpec = yield* resolvePlacementResponseSpec(placement).pipe(
      Effect.mapError((cause) => migrationError(cause.message, cause))
    );

    if (mode === "contract") {
      if (!placement.choiceSnapshots) {
        return false;
      }
      yield* migrationPromise("remove placement predecessor definition", () =>
        ctx.db.patch(placement._id, { choiceSnapshots: undefined })
      );
      return true;
    }

    if (placement.responseSpec) {
      return false;
    }
    if (!isAttemptPlacementWithinBudget({ ...placement, responseSpec })) {
      return yield* migrationError(
        "Try-out placement exceeds the runtime read ceiling after hydration."
      );
    }
    yield* migrationPromise("write placement response definition", () =>
      ctx.db.patch(placement._id, { responseSpec })
    );
    return true;
  }
);

/** Migrates one bounded response page in the requested rollout direction. */
const migrateResponsePage = Effect.fn("tryouts.response.migrateResponsePage")(
  function* (ctx: MutationCtx, cursor: string | null, mode: MigrationMode) {
    const result = yield* migrationPromise("load learner response page", () =>
      ctx.db.query("tryoutResponses").paginate({
        cursor,
        maximumBytesRead: PAGE_BYTES,
        maximumRowsRead: PAGE_ROWS,
        numItems: PAGE_ROWS,
      })
    );
    const migrated = yield* Effect.forEach(result.page, (response) =>
      migrateResponse(ctx, response, mode)
    );
    return pageResult(result, migrated);
  }
);

/** Hydrates or contracts one response after link and score proof. */
const migrateResponse = Effect.fn("tryouts.response.migrateResponse")(
  function* (
    ctx: MutationCtx,
    response: Doc<"tryoutResponses">,
    mode: MigrationMode
  ) {
    const placement = yield* migrationPromise("load response placement", () =>
      ctx.db.get(response.placementId)
    );
    if (!placement) {
      return yield* migrationError(
        "Try-out response references a missing placement."
      );
    }
    if (placement.tryoutAttemptId !== response.tryoutAttemptId) {
      return yield* migrationError(
        "Try-out response and placement belong to different attempts."
      );
    }
    const section = yield* loadPlacementSectionAttempt(ctx, placement).pipe(
      Effect.mapError((cause) => migrationError(cause.message, cause))
    );
    if (!section || section._id !== response.tryoutSectionAttemptId) {
      return yield* migrationError(
        "Try-out response and placement belong to different sections."
      );
    }
    if (
      mode === "contract" &&
      (!response.selection || response.isComplete === undefined)
    ) {
      return yield* migrationError(
        "Try-out response has no complete canonical learner selection."
      );
    }
    const responseSpec = yield* resolvePlacementResponseSpec(placement).pipe(
      Effect.mapError((cause) => migrationError(cause.message, cause))
    );
    const selection = yield* resolveStoredResponseSelection(response).pipe(
      Effect.mapError((cause) => migrationError(cause.message, cause))
    );
    const evaluated = yield* evaluateTryoutResponse(
      responseSpec,
      selection
    ).pipe(Effect.mapError((cause) => migrationError(cause.message, cause)));
    if (
      response.isCorrect !== evaluated.isCorrect ||
      (response.isComplete !== undefined &&
        response.isComplete !== evaluated.isComplete)
    ) {
      return yield* migrationError(
        "Try-out response differs from its frozen answer definition."
      );
    }

    if (mode === "contract") {
      if (response.selectedOptionId === undefined) {
        return false;
      }
      yield* migrationPromise("remove learner response predecessor", () =>
        ctx.db.patch(response._id, { selectedOptionId: undefined })
      );
      return true;
    }

    if (response.selection && response.isComplete !== undefined) {
      return false;
    }
    yield* migrationPromise("write learner response selection", () =>
      ctx.db.patch(response._id, {
        isComplete: evaluated.isComplete,
        selection: evaluated.selection,
      })
    );
    return true;
  }
);

/** Returns the operational counters for one bounded database page. */
function pageResult<Row>(
  result: { continueCursor: string; isDone: boolean; page: readonly Row[] },
  migrated: readonly boolean[]
): MigratedPage {
  return {
    continueCursor: result.continueCursor,
    isDone: result.isDone,
    migrated: migrated.filter(Boolean).length,
    visited: result.page.length,
  };
}

/** Lifts one Convex operation into the stable migration error channel. */
function migrationPromise<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      migrationError(
        `Unable to ${message}: ${getUnknownErrorMessage(cause)}`,
        cause
      ),
    try: operation,
  });
}

/** Creates one fail-closed migration error. */
function migrationError(message: string, cause?: unknown) {
  return new TryoutResponseMigrationError({
    ...(cause === undefined ? {} : { cause }),
    code: "TRYOUT_RESPONSE_MIGRATION_INVALID",
    message,
  });
}
