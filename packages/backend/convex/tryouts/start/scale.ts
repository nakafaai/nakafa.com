import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { requireIrtScaleVersion } from "@repo/backend/convex/tryouts/runtime/irt/items";
import type {
  SignedTryoutSource,
  TryoutStartSource,
} from "@repo/backend/convex/tryouts/start/source";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

const IRT_MODEL = "2pl";
const PROVISIONAL_DIFFICULTY = 0;
const PROVISIONAL_DISCRIMINATION = 1;

type IrtScale = Doc<"irtScaleVersions">;
type IrtScaleItem = Doc<"irtScaleItems">;

/** Selects or creates the exact signed IRT scale frozen into one new attempt. */
export const selectAttemptScale = Effect.fn("tryouts.start.selectAttemptScale")(
  function* (
    ctx: MutationCtx,
    set: Doc<"tryoutSets">,
    source: TryoutStartSource,
    publishedAt: number
  ) {
    if (set.scoringStrategy !== "irt") {
      return null;
    }

    if (source.kind === "local") {
      return yield* Effect.tryPromise({
        catch: toTryoutStartError,
        try: () => requireIrtScaleVersion(ctx, { tryoutSetId: set._id }),
      });
    }

    const scale = yield* loadExactScale(ctx, set, source);
    if (scale) {
      yield* verifyScaleItems(ctx, scale, source);
      return scale;
    }

    return yield* publishSignedScale(ctx, {
      publishedAt,
      set,
      source,
    });
  }
);

/** Loads at most one scale bound to the exact signed snapshot. */
const loadExactScale = Effect.fn("tryouts.start.loadExactScale")(function* (
  ctx: MutationCtx,
  set: Doc<"tryoutSets">,
  source: SignedTryoutSource
) {
  const scales = yield* tryScalePromise(() =>
    ctx.db
      .query("irtScaleVersions")
      .withIndex(
        "by_tryoutSnapshotId_and_setIdentity_and_publishedAt",
        (query) =>
          query
            .eq("tryoutSnapshotId", source.snapshot.snapshotId)
            .eq("setIdentity", source.snapshot.setIdentity)
      )
      .take(2)
  );
  if (scales.length > 1) {
    return yield* scaleError("Signed try-out has duplicate IRT scales.");
  }

  const scale = scales.at(0);
  if (!scale) {
    return null;
  }
  if (
    scale.tryoutSetId !== set._id ||
    scale.questionCount !== source.snapshot.set.row.questionCount
  ) {
    return yield* scaleError(
      "Signed IRT scale does not match its try-out set."
    );
  }
  return scale;
});

/** Creates a new immutable scale from authenticated signed placements. */
const publishSignedScale = Effect.fn("tryouts.start.publishSignedScale")(
  function* (
    ctx: MutationCtx,
    args: {
      publishedAt: number;
      set: Doc<"tryoutSets">;
      source: SignedTryoutSource;
    }
  ) {
    const placements = signedPlacements(args.source);
    if (placements.length !== args.source.snapshot.set.row.questionCount) {
      return yield* scaleError(
        "Signed IRT scale cannot cover an incomplete try-out snapshot."
      );
    }

    const previous = yield* loadPreviousScale(ctx, args.set, args.source);
    const previousItems = previous
      ? yield* loadScaleItemMap(ctx, previous)
      : new Map<string, IrtScaleItem>();
    const reusesEveryItem = placements.every(({ identity, rowHash }) => {
      const item = previousItems.get(identity);
      return item?.placementRowHash === rowHash;
    });
    const status =
      previous?.status === "official" && reusesEveryItem
        ? "official"
        : "provisional";
    const scaleVersionId = yield* tryScalePromise(() =>
      ctx.db.insert("irtScaleVersions", {
        model: IRT_MODEL,
        publishedAt: args.publishedAt,
        questionCount: placements.length,
        setIdentity: args.source.snapshot.setIdentity,
        status,
        tryoutSetId: args.set._id,
        tryoutSnapshotId: args.source.snapshot.snapshotId,
      })
    );

    for (const { signed } of args.source.sections) {
      const sectionIdentity = tryoutCatalogIdentity(signed.section.row);
      const calibrationRunId = yield* tryScalePromise(() =>
        ctx.db.insert("irtCalibrationRuns", {
          attemptCount: 0,
          completedAt: args.publishedAt,
          iterationCount: 0,
          maxParameterDelta: 0,
          model: IRT_MODEL,
          questionCount: signed.placements.length,
          responseCount: 0,
          scaleVersionId,
          sectionIdentity,
          startedAt: args.publishedAt,
          status: "completed",
          updatedAt: args.publishedAt,
        })
      );

      for (const placement of signed.placements) {
        const identity = tryoutPlacementIdentity(placement.row);
        const previousItem = previousItems.get(identity);
        const reusable =
          previousItem?.placementRowHash === placement.rowHash
            ? previousItem
            : null;
        yield* tryScalePromise(() =>
          ctx.db.insert("irtScaleItems", {
            calibrationRunId,
            calibrationStatus: reusable?.calibrationStatus ?? "provisional",
            correctRate: reusable?.correctRate ?? 0,
            difficulty: reusable?.difficulty ?? PROVISIONAL_DIFFICULTY,
            discrimination:
              reusable?.discrimination ?? PROVISIONAL_DISCRIMINATION,
            placementIdentity: identity,
            placementRowHash: placement.rowHash,
            responseCount: reusable?.responseCount ?? 0,
            scaleVersionId,
          })
        );
      }
    }

    const scale = yield* tryScalePromise(() => ctx.db.get(scaleVersionId));
    if (!scale) {
      return yield* scaleError("Signed IRT scale was not persisted.");
    }
    return scale;
  }
);

/** Loads the latest earlier signed scale for the same logical set. */
const loadPreviousScale = Effect.fn("tryouts.start.loadPreviousScale")(
  function* (
    ctx: MutationCtx,
    set: Doc<"tryoutSets">,
    source: SignedTryoutSource
  ) {
    const scale = yield* tryScalePromise(() =>
      ctx.db
        .query("irtScaleVersions")
        .withIndex("by_setIdentity_and_publishedAt", (query) =>
          query.eq("setIdentity", source.snapshot.setIdentity)
        )
        .order("desc")
        .first()
    );
    if (scale && scale.tryoutSetId !== set._id) {
      return yield* scaleError(
        "Signed IRT scale identity belongs to another try-out set."
      );
    }
    return scale;
  }
);

/** Verifies one stored scale covers every authenticated signed placement. */
const verifyScaleItems = Effect.fn("tryouts.start.verifyScaleItems")(function* (
  ctx: MutationCtx,
  scale: IrtScale,
  source: SignedTryoutSource
) {
  const items = yield* loadScaleItemMap(ctx, scale);
  const placements = signedPlacements(source);
  const matches = placements.every(
    ({ identity, rowHash }) => items.get(identity)?.placementRowHash === rowHash
  );
  if (!matches || items.size !== placements.length) {
    return yield* scaleError(
      "Signed IRT scale does not cover the authenticated placement snapshot."
    );
  }
});

/** Loads one complete scale item map and rejects missing identities. */
const loadScaleItemMap = Effect.fn("tryouts.start.loadScaleItemMap")(function* (
  ctx: MutationCtx,
  scale: IrtScale
) {
  const items = yield* tryScalePromise(() =>
    ctx.db
      .query("irtScaleItems")
      .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
        query.eq("scaleVersionId", scale._id)
      )
      .take(scale.questionCount + 1)
  );
  if (items.length !== scale.questionCount) {
    return yield* scaleError("Signed IRT scale has incomplete item coverage.");
  }

  const itemsByIdentity = new Map<string, IrtScaleItem>();
  for (const item of items) {
    if (
      !item.placementIdentity ||
      itemsByIdentity.has(item.placementIdentity)
    ) {
      return yield* scaleError(
        "Signed IRT scale has a missing or duplicate item identity."
      );
    }
    itemsByIdentity.set(item.placementIdentity, item);
  }
  return itemsByIdentity;
});

/** Flattens authenticated placements with their immutable identity fields. */
function signedPlacements(source: SignedTryoutSource) {
  return source.sections.flatMap(({ signed }) =>
    signed.placements.map((placement) => ({
      identity: tryoutPlacementIdentity(placement.row),
      rowHash: placement.rowHash,
    }))
  );
}

/** Creates one typed fail-closed scale error. */
function scaleError(message: string) {
  return new TryoutStartError({
    code: tryoutStartErrorCode.irtScaleRequired,
    message,
  });
}

/** Lifts one Convex promise into the typed start failure channel. */
function tryScalePromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
