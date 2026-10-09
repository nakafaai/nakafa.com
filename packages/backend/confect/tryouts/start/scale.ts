import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { TryoutRuntimeError } from "@repo/backend/confect/tryouts/runtime/error";
import type { TryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import { toTryoutStartError } from "@repo/backend/confect/tryouts/start/spec";
import { Array as Arr, Effect, flow, MutableHashMap, Option } from "effect";

const IRT_MODEL = "2pl";
const PROVISIONAL_DIFFICULTY = 0;
const PROVISIONAL_DISCRIMINATION = 1;
type IrtScale = Docs["irtScaleVersions"];
type IrtScaleItem = Docs["irtScaleItems"];

/** Selects or creates the exact signed IRT scale frozen into one new attempt. */
export const selectAttemptScale = Effect.fn("tryouts.start.selectAttemptScale")(
  function* (source: TryoutStartSource, publishedAt: number) {
    const scoringStrategy = source.snapshot.set.row.scoringStrategy;
    if (scoringStrategy !== "irt") {
      return null;
    }
    const scale = yield* loadExactScale(source);
    if (scale) {
      yield* verifyScaleItems(scale, source);
      return scale;
    }
    return yield* publishSignedScale({
      publishedAt,
      source,
    });
  },
  Effect.catchDefect(flow(toTryoutStartError, Effect.fail))
);

/** Loads at most one scale bound to the exact signed snapshot. */
const loadExactScale = Effect.fn("tryouts.start.loadExactScale")(function* (
  source: TryoutStartSource
) {
  const database = yield* DatabaseReader;
  const scales = yield* database
    .table("irtScaleVersions")
    .index(
      "by_tryoutSnapshotId_and_setIdentity_and_history_and_publishedAt",
      (query) =>
        query
          .eq("tryoutSnapshotId", source.snapshot.snapshotId)
          .eq("setIdentity", source.snapshot.setIdentity)
          .eq("history", undefined)
    )
    .take(2)
    .pipe(Effect.orDie);
  if (scales.length > 1) {
    return yield* scaleError("Signed try-out has duplicate IRT scales.");
  }
  const scale = scales.at(0);
  if (!scale) {
    return null;
  }
  if (scale.questionCount !== source.snapshot.set.row.questionCount) {
    return yield* scaleError(
      "Signed IRT scale does not match its try-out set."
    );
  }
  return scale;
});

/** Creates a new immutable scale from authenticated signed placements. */
const publishSignedScale = Effect.fn("tryouts.start.publishSignedScale")(
  function* (args: { publishedAt: number; source: TryoutStartSource }) {
    const writer = yield* DatabaseWriter;
    const placements = signedPlacements(args.source);
    if (placements.length !== args.source.snapshot.set.row.questionCount) {
      return yield* scaleError(
        "Signed IRT scale cannot cover an incomplete try-out snapshot."
      );
    }
    const previous = yield* loadPreviousScale(args.source);
    const previousItems = previous
      ? yield* loadScaleItemMap(previous)
      : MutableHashMap.empty<string, IrtScaleItem>();
    const reusesEveryItem = Arr.every(placements, ({ identity, rowHash }) => {
      const item = Option.getOrUndefined(
        MutableHashMap.get(previousItems, identity)
      );
      return item?.placementRowHash === rowHash;
    });
    const status =
      previous?.status === "official" && reusesEveryItem
        ? "official"
        : "provisional";
    const scaleVersionId = yield* writer
      .table("irtScaleVersions")
      .insert({
        model: IRT_MODEL,
        publishedAt: args.publishedAt,
        questionCount: placements.length,
        setIdentity: args.source.snapshot.setIdentity,
        status,
        tryoutSnapshotId: args.source.snapshot.snapshotId,
      })
      .pipe(Effect.orDie);
    for (const { placements: sectionPlacements, section } of args.source
      .snapshot.sections) {
      const sectionIdentity = tryoutCatalogIdentity(section.row);
      const calibrationRunId = yield* writer
        .table("irtCalibrationRuns")
        .insert({
          attemptCount: 0,
          completedAt: args.publishedAt,
          iterationCount: 0,
          maxParameterDelta: 0,
          model: IRT_MODEL,
          questionCount: sectionPlacements.length,
          responseCount: 0,
          scaleVersionId,
          sectionIdentity,
          startedAt: args.publishedAt,
          status: "completed",
          updatedAt: args.publishedAt,
        })
        .pipe(Effect.orDie);
      for (const placement of sectionPlacements) {
        const identity = tryoutPlacementIdentity(placement.row);
        const previousItem = Option.getOrUndefined(
          MutableHashMap.get(previousItems, identity)
        );
        const reusable =
          previousItem?.placementRowHash === placement.rowHash
            ? previousItem
            : null;
        yield* writer
          .table("irtScaleItems")
          .insert({
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
          .pipe(Effect.orDie);
      }
    }
    const scale = yield* (yield* DatabaseReader)
      .table("irtScaleVersions")
      .get(scaleVersionId)
      .pipe(Effect.orDie);
    return scale;
  }
);

/** Loads the latest earlier signed scale for the same logical set. */
const loadPreviousScale = Effect.fn("tryouts.start.loadPreviousScale")(
  function* (source: TryoutStartSource) {
    const database = yield* DatabaseReader;
    const scale = yield* database
      .table("irtScaleVersions")
      .index(
        "by_setIdentity_and_history_and_publishedAt",
        (query) =>
          query
            .eq("setIdentity", source.snapshot.setIdentity)
            .eq("history", undefined),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
    return scale;
  }
);

/** Verifies one stored scale covers every authenticated signed placement. */
const verifyScaleItems = Effect.fn("tryouts.start.verifyScaleItems")(function* (
  scale: IrtScale,
  source: TryoutStartSource
) {
  const items = yield* loadScaleItemMap(scale);
  const placements = signedPlacements(source);
  const matches = Arr.every(
    placements,
    ({ identity, rowHash }) =>
      Option.getOrUndefined(MutableHashMap.get(items, identity))
        ?.placementRowHash === rowHash
  );
  if (!matches || MutableHashMap.size(items) !== placements.length) {
    return yield* scaleError(
      "Signed IRT scale does not cover the authenticated placement snapshot."
    );
  }
});

/** Loads one complete scale item map and rejects missing identities. */
const loadScaleItemMap = Effect.fn("tryouts.start.loadScaleItemMap")(function* (
  scale: IrtScale
) {
  const database = yield* DatabaseReader;
  const items = yield* database
    .table("irtScaleItems")
    .index("by_scaleVersionId_and_placementIdentity", (query) =>
      query.eq("scaleVersionId", scale._id)
    )
    .take(scale.questionCount + 1)
    .pipe(Effect.orDie);
  if (items.length !== scale.questionCount) {
    return yield* scaleError("Signed IRT scale has incomplete item coverage.");
  }
  const itemsByIdentity = MutableHashMap.empty<string, IrtScaleItem>();
  for (const item of items) {
    if (MutableHashMap.has(itemsByIdentity, item.placementIdentity)) {
      return yield* scaleError(
        "Signed IRT scale has a missing or duplicate item identity."
      );
    }
    MutableHashMap.set(itemsByIdentity, item.placementIdentity, item);
  }
  return itemsByIdentity;
});

/** Flattens authenticated placements with their immutable identity fields. */
function signedPlacements(source: TryoutStartSource) {
  return Arr.flatMap(source.snapshot.sections, ({ placements }) =>
    Arr.map(placements, (placement) => ({
      identity: tryoutPlacementIdentity(placement.row),
      rowHash: placement.rowHash,
    }))
  );
}

/** Creates one typed fail-closed scale error. */
function scaleError(message: string) {
  return TryoutRuntimeError.make({
    code: "TRYOUT_IRT_SCALE_REQUIRED",
    message,
  });
}
