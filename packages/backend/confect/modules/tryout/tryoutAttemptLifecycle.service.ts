import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import {
  requireActiveTryoutAttemptAfterExpirySync,
  requireOwnedTryoutAttempt,
} from "@repo/backend/confect/modules/tryout/tryoutAttemptAccess.service";
import { finalizeTryoutAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAttempt.service";
import { finalizeTryoutPartAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizePart.service";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import {
  loadValidatedTryoutPartSets,
  resolveRequestedTryoutPart,
} from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import type { TryoutAttempts } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect, Option } from "effect";

type TryoutAttemptDoc = typeof TryoutAttempts.Doc.Type;

/** Loads an active tryout by public route parameters. */
export const loadStartableTryout = Effect.fn(
  "tryouts.lifecycle.loadStartableTryout"
)(function* (args: {
  readonly locale: Locale;
  readonly product: TryoutProduct;
  readonly tryoutSlug: string;
}) {
  const reader = yield* DatabaseReader;
  const tryout = yield* reader
    .table("tryouts")
    .index("by_product_and_locale_and_slug", (query) =>
      query
        .eq("product", args.product)
        .eq("locale", args.locale)
        .eq("slug", args.tryoutSlug)
    )
    .first()
    .pipe(
      Effect.map(Option.getOrNull),
      Effect.catchTag("DocumentDecodeError", () =>
        Effect.fail(
          new TryoutError({
            code: "INVALID_TRYOUT_STATE",
            message: "Tryout data could not be decoded.",
          })
        )
      )
    );

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  if (tryout.isActive) {
    return tryout;
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "TRYOUT_INACTIVE",
      message: "This tryout is not currently active.",
    })
  );
});

/** Reuses a currently active attempt when it can still be resumed. */
export const reuseExistingTryoutAttempt = Effect.fn(
  "tryouts.lifecycle.reuseExistingTryoutAttempt"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly now: number;
    readonly tryoutAttempt: TryoutAttemptDoc;
    readonly userId: Id<"users">;
  }
) {
  const activeTryoutAttempt = yield* requireActiveTryoutAttemptAfterExpirySync({
    now: args.now,
    tryoutAttempt: args.tryoutAttempt,
  }).pipe(
    Effect.catchTag("TryoutError", (error) => {
      if (error.code === "TRYOUT_EXPIRED") {
        return Effect.succeed(null);
      }

      return Effect.fail(error);
    })
  );

  if (!activeTryoutAttempt) {
    return false;
  }

  const firstIncompletePartIndex = getFirstIncompleteTryoutPartIndex({
    completedPartIndices: activeTryoutAttempt.completedPartIndices,
    partCount: activeTryoutAttempt.partSetSnapshots.length,
  });

  if (firstIncompletePartIndex !== undefined) {
    return true;
  }

  const completedAttempt = yield* finalizeTryoutAttempt({
    ctx,
    now: args.now,
    tryoutAttempt: activeTryoutAttempt,
    userId: args.userId,
  });

  if (completedAttempt.status === "completed") {
    return true;
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "INVALID_TRYOUT_STATE",
      message: "Tryout has no incomplete part but could not be finalized.",
    })
  );
});

/** Loads the context required to start a tryout part. */
export const loadPartStartContext = Effect.fn(
  "tryouts.lifecycle.loadPartStartContext"
)(function* (args: {
  readonly now: number;
  readonly partKey: string;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
  readonly userId: Id<"users">;
}) {
  const tryoutAttempt = yield* requireOwnedTryoutAttempt({
    tryoutAttemptId: args.tryoutAttemptId,
    userId: args.userId,
  });
  const activeTryoutAttempt = yield* requireActiveTryoutAttemptAfterExpirySync({
    now: args.now,
    tryoutAttempt,
  });
  const reader = yield* DatabaseReader;
  const tryout = yield* reader
    .table("tryouts")
    .get(activeTryoutAttempt.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  const currentPartSets = yield* loadValidatedTryoutPartSets({
    partCount: tryout.partCount,
    tryoutId: tryout._id,
  });
  const resolvedPart = resolveRequestedTryoutPart({
    currentPartSets,
    partSetSnapshots: activeTryoutAttempt.partSetSnapshots,
    requestedPartKey: args.partKey,
  });
  const tryoutPartSnapshot = resolvedPart?.snapshot ?? null;

  if (!tryoutPartSnapshot) {
    return yield* Effect.fail(
      new TryoutError({
        code: "PART_NOT_FOUND",
        message: "Tryout part not found.",
      })
    );
  }

  if (
    !activeTryoutAttempt.completedPartIndices.includes(
      tryoutPartSnapshot.partIndex
    )
  ) {
    return { tryout, tryoutPartSnapshot };
  }

  return yield* Effect.fail(
    new TryoutError({
      code: "PART_ALREADY_COMPLETED",
      message: "This tryout part has already been completed.",
    })
  );
});

/** Reuses an active part attempt or expires the stale one. */
export const reuseExistingPartAttempt = Effect.fn(
  "tryouts.lifecycle.reuseExistingPartAttempt"
)(function* (args: {
  readonly now: number;
  readonly partIndex: number;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const existingPartAttempt = yield* reader
    .table("tryoutPartAttempts")
    .index("by_tryoutAttemptId_and_partIndex", (query) =>
      query
        .eq("tryoutAttemptId", args.tryoutAttemptId)
        .eq("partIndex", args.partIndex)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!existingPartAttempt) {
    return false;
  }

  const existingSetAttempt = yield* reader
    .table("exerciseAttempts")
    .get(existingPartAttempt.setAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!existingSetAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part attempt exists without its exercise attempt.",
      })
    );
  }

  if (existingSetAttempt.status !== "in-progress") {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part state is out of sync with its tryout attempt.",
      })
    );
  }

  const expiresAtMs =
    existingSetAttempt.startedAt + existingSetAttempt.timeLimit * 1e3;

  if (args.now < expiresAtMs) {
    return true;
  }

  yield* finalizeTryoutPartAttempt({
    finishedAtMs: expiresAtMs,
    now: args.now,
    partAttempt: existingPartAttempt,
    status: "expired",
    tryoutAttemptId: args.tryoutAttemptId,
  });

  return yield* Effect.fail(
    new TryoutError({
      code: "TRYOUT_PART_EXPIRED",
      message: "This tryout part has already expired.",
    })
  );
});
