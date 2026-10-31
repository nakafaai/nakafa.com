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

/** The places of a set's paper with their sections, the units an IRT scale calibrates by family. */
function paperPlaces(source: TryoutStartSource) {
  return Arr.flatMap(source.paper.paper.sections, ({ placements, section }) =>
    Arr.map(placements, ({ family }) => ({ family, sectionKey: section }))
  );
}

/**
 * Selects or creates the IRT scale frozen into one new attempt of an IRT set: the scale of the set in
 * the snapshot the attempt starts from, or a new one that carries over each family's calibration from
 * the set's latest scale.
 */
export const selectAttemptScale = Effect.fn("tryouts.start.selectAttemptScale")(
  function* (source: TryoutStartSource, publishedAt: number) {
    if (source.profile.profile.scoring.kind !== "irt") {
      return null;
    }
    const scale = yield* loadExactScale(source);
    if (scale) {
      yield* verifyScaleItems(scale, source);
      return scale;
    }
    return yield* publishScale({ publishedAt, source });
  },
  Effect.catchDefect(flow(toTryoutStartError, Effect.fail))
);

/** Loads at most one scale of the set in the snapshot the attempt starts from. */
const loadExactScale = Effect.fn("tryouts.start.loadExactScale")(function* (
  source: TryoutStartSource
) {
  const database = yield* DatabaseReader;
  const scales = yield* database
    .table("irtScaleVersions")
    .index("by_assessmentSnapshotId_and_setIdentity_and_publishedAt", (query) =>
      query
        .eq("assessmentSnapshotId", source.active.snapshotId)
        .eq("setIdentity", source.setIdentity)
    )
    .take(2)
    .pipe(Effect.orDie);
  if (scales.length > 1) {
    return yield* scaleError("The try-out set has duplicate IRT scales.");
  }
  const scale = Arr.head(scales);
  if (Option.isNone(scale)) {
    return null;
  }
  if (scale.value.questionCount !== paperPlaces(source).length) {
    return yield* scaleError("The IRT scale does not match its try-out paper.");
  }
  return scale.value;
});

/**
 * Creates a new immutable scale for the set's paper. Each family keeps the calibration the set's
 * latest scale holds for it, since every language and version of a family shares one structure, and
 * a new family starts provisional. The scale is official only when the latest one was and every
 * family carries over.
 */
const publishScale = Effect.fn("tryouts.start.publishScale")(function* (args: {
  publishedAt: number;
  source: TryoutStartSource;
}) {
  const writer = yield* DatabaseWriter;
  const places = paperPlaces(args.source);
  const previous = yield* loadPreviousScale(args.source);
  const previousItems = previous
    ? yield* loadScaleItemMap(previous)
    : MutableHashMap.empty<string, IrtScaleItem>();
  const reusesEveryItem = Arr.every(places, ({ family }) =>
    MutableHashMap.has(previousItems, family)
  );
  const status =
    previous?.status === "official" && reusesEveryItem
      ? "official"
      : "provisional";
  const scaleVersionId = yield* writer
    .table("irtScaleVersions")
    .insert({
      assessmentSnapshotId: args.source.active.snapshotId,
      model: IRT_MODEL,
      publishedAt: args.publishedAt,
      questionCount: places.length,
      setIdentity: args.source.setIdentity,
      status,
    })
    .pipe(Effect.orDie);
  for (const { placements, section } of args.source.paper.paper.sections) {
    const calibrationRunId = yield* writer
      .table("irtCalibrationRuns")
      .insert({
        attemptCount: 0,
        completedAt: args.publishedAt,
        iterationCount: 0,
        maxParameterDelta: 0,
        model: IRT_MODEL,
        questionCount: placements.length,
        responseCount: 0,
        scaleVersionId,
        sectionKey: section,
        startedAt: args.publishedAt,
        status: "completed",
        updatedAt: args.publishedAt,
      })
      .pipe(Effect.orDie);
    for (const { family } of placements) {
      const reusable = Option.getOrUndefined(
        MutableHashMap.get(previousItems, family)
      );
      yield* writer
        .table("irtScaleItems")
        .insert({
          calibrationRunId,
          calibrationStatus: reusable?.calibrationStatus ?? "provisional",
          correctRate: reusable?.correctRate ?? 0,
          difficulty: reusable?.difficulty ?? PROVISIONAL_DIFFICULTY,
          discrimination:
            reusable?.discrimination ?? PROVISIONAL_DISCRIMINATION,
          family,
          responseCount: reusable?.responseCount ?? 0,
          scaleVersionId,
        })
        .pipe(Effect.orDie);
    }
  }
  return yield* (yield* DatabaseReader)
    .table("irtScaleVersions")
    .get(scaleVersionId)
    .pipe(Effect.orDie);
});

/** Loads the latest earlier scale of the same set, from any snapshot. */
const loadPreviousScale = Effect.fn("tryouts.start.loadPreviousScale")(
  function* (source: TryoutStartSource) {
    const database = yield* DatabaseReader;
    return yield* database
      .table("irtScaleVersions")
      .index(
        "by_setIdentity_and_publishedAt",
        (query) => query.eq("setIdentity", source.setIdentity),
        "desc"
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie);
  }
);

/** Verifies one stored scale calibrates exactly the families of the set's paper. */
const verifyScaleItems = Effect.fn("tryouts.start.verifyScaleItems")(function* (
  scale: IrtScale,
  source: TryoutStartSource
) {
  const items = yield* loadScaleItemMap(scale);
  const places = paperPlaces(source);
  if (
    !Arr.every(places, ({ family }) => MutableHashMap.has(items, family)) ||
    MutableHashMap.size(items) !== places.length
  ) {
    return yield* scaleError(
      "The IRT scale does not calibrate every family of the try-out paper."
    );
  }
});

/** Loads one complete scale item map by family and rejects missing or repeated families. */
const loadScaleItemMap = Effect.fn("tryouts.start.loadScaleItemMap")(function* (
  scale: IrtScale
) {
  const database = yield* DatabaseReader;
  const items = yield* database
    .table("irtScaleItems")
    .index("by_scaleVersionId_and_family", (query) =>
      query.eq("scaleVersionId", scale._id)
    )
    .take(scale.questionCount + 1)
    .pipe(Effect.orDie);
  if (items.length !== scale.questionCount) {
    return yield* scaleError("The IRT scale has incomplete item coverage.");
  }
  const itemsByFamily = MutableHashMap.empty<string, IrtScaleItem>();
  for (const item of items) {
    if (MutableHashMap.has(itemsByFamily, item.family)) {
      return yield* scaleError("The IRT scale repeats an item family.");
    }
    MutableHashMap.set(itemsByFamily, item.family, item);
  }
  return itemsByFamily;
});

/** Creates one typed fail-closed scale error. */
function scaleError(message: string) {
  return new TryoutRuntimeError({
    code: "TRYOUT_IRT_SCALE_REQUIRED",
    message,
  });
}
