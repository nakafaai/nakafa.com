import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { getProvisionalParams } from "@repo/backend/confect/modules/tryout/irt.estimation";
import { IRT_OPERATIONAL_MODEL } from "@repo/backend/confect/modules/tryout/irt.policy";
import {
  loadValidatedScaleSetData,
  loadValidatedScaleTryoutSets,
} from "@repo/backend/confect/modules/tryout/irtScaleLoaders.service";
import { evaluateTryoutScaleQuality } from "@repo/backend/confect/modules/tryout/irtScaleQuality.service";
import {
  getLatestScaleVersionForTryout,
  getScaleVersionItems,
} from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import {
  getPublishableScaleSnapshot,
  hasPublishedScaleChanged,
} from "@repo/backend/confect/modules/tryout/irtScaleSnapshot.service";
import { Clock, Duration, Effect } from "effect";

interface ScaleItem {
  readonly calibrationRunId: Id<"irtCalibrationRuns">;
  readonly difficulty: number;
  readonly discrimination: number;
  readonly questionId: Id<"exerciseQuestions">;
  readonly setId: Id<"exerciseSets">;
}

/** Persists one frozen IRT scale version and its item rows. */
const publishScaleVersion = Effect.fn("irt.scales.publishScaleVersion")(
  function* (args: {
    readonly items: readonly ScaleItem[];
    readonly publishedAt: number;
    readonly questionCount: number;
    readonly status: "official" | "provisional";
    readonly tryoutId: Id<"tryouts">;
  }) {
    const writer = yield* DatabaseWriter;

    if (args.items.length !== args.questionCount) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_SCALE_ITEM_COUNT_MISMATCH",
          message:
            "Frozen scale item count does not match the scale version question count.",
        })
      );
    }

    const questionIds = new Set(args.items.map((item) => item.questionId));

    if (questionIds.size !== args.items.length) {
      return yield* Effect.fail(
        new IrtError({
          code: "IRT_SCALE_ITEM_DUPLICATE_QUESTION",
          message: "Frozen scale items contain duplicate questions.",
        })
      );
    }

    const scaleVersionId = yield* writer.table("irtScaleVersions").insert({
      model: IRT_OPERATIONAL_MODEL,
      publishedAt: args.publishedAt,
      questionCount: args.questionCount,
      status: args.status,
      tryoutId: args.tryoutId,
    });

    for (const item of args.items) {
      yield* writer.table("irtScaleVersionItems").insert({
        calibrationRunId: item.calibrationRunId,
        difficulty: item.difficulty,
        discrimination: item.discrimination,
        questionId: item.questionId,
        scaleVersionId,
        setId: item.setId,
      });
    }

    return scaleVersionId;
  }
);

/** Creates bootstrap scale items from calibrated params or provisional defaults. */
const buildBootstrapScaleItems = Effect.fn(
  "irt.scales.buildBootstrapScaleItems"
)(function* (args: { readonly now: number; readonly tryoutId: Id<"tryouts"> }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const tryout = yield* reader
    .table("tryouts")
    .get(args.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return null;
  }

  const tryoutSets = yield* loadValidatedScaleTryoutSets(tryout);

  if (tryoutSets.length === 0) {
    return null;
  }

  const scaleItemsBySet = yield* Effect.forEach(
    tryoutSets,
    ({ partSet, set }) =>
      Effect.gen(function* () {
        const { itemParams, questions } = yield* loadValidatedScaleSetData(set);

        if (questions.length === 0) {
          return null;
        }

        const paramsByQuestionId = new Map(
          itemParams.map((params) => [params.questionId, params])
        );
        const bootstrapRunId = yield* writer
          .table("irtCalibrationRuns")
          .insert({
            attemptCount: 0,
            completedAt: args.now,
            iterationCount: 0,
            maxParameterDelta: 0,
            model: IRT_OPERATIONAL_MODEL,
            questionCount: questions.length,
            responseCount: 0,
            setId: partSet.setId,
            startedAt: args.now,
            status: "completed",
            updatedAt: args.now,
          });

        return questions.map((question) => {
          const params = paramsByQuestionId.get(question._id);
          const provisional = getProvisionalParams();

          return {
            calibrationRunId: params?.calibrationRunId ?? bootstrapRunId,
            difficulty: params?.difficulty ?? provisional.difficulty,
            discrimination:
              params?.discrimination ?? provisional.discrimination,
            questionId: question._id,
            setId: partSet.setId,
          };
        });
      })
  );

  const validScaleItemsBySet = scaleItemsBySet.filter(
    (setItems) => setItems !== null
  );

  if (validScaleItemsBySet.length !== scaleItemsBySet.length) {
    return null;
  }

  const items = validScaleItemsBySet.flat();

  return items;
});

/** Publishes a provisional scale version when a tryout has enough set data. */
const publishBootstrapScaleVersion = Effect.fn(
  "irt.scales.publishBootstrapScaleVersion"
)(function* (args: { readonly now: number; readonly tryoutId: Id<"tryouts"> }) {
  const reader = yield* DatabaseReader;
  const items = yield* buildBootstrapScaleItems(args);

  if (!items) {
    return null;
  }

  const scaleVersionId = yield* publishScaleVersion({
    items,
    publishedAt: args.now,
    questionCount: items.length,
    status: "provisional",
    tryoutId: args.tryoutId,
  });

  return yield* reader
    .table("irtScaleVersions")
    .get(scaleVersionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
});

/** Publishes an official scale version from a validated snapshot. */
const publishOfficialScaleVersion = Effect.fn(
  "irt.scales.publishOfficialScaleVersion"
)(function* (args: {
  readonly now: number;
  readonly snapshot: {
    readonly items: readonly ScaleItem[];
    readonly questionCount: number;
  };
  readonly tryoutId: Id<"tryouts">;
}) {
  const reader = yield* DatabaseReader;
  const scaleVersionId = yield* publishScaleVersion({
    items: args.snapshot.items,
    publishedAt: args.now,
    questionCount: args.snapshot.questionCount,
    status: "official",
    tryoutId: args.tryoutId,
  });

  return yield* reader
    .table("irtScaleVersions")
    .get(scaleVersionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
});

/** Reuses the latest official scale when the publishable snapshot is unchanged. */
const getUnchangedOfficialScaleVersion = Effect.fn(
  "irt.scales.getUnchangedOfficialScaleVersion"
)(function* (args: {
  readonly latestScaleVersion: Doc<"irtScaleVersions"> | null;
  readonly snapshot: {
    readonly items: readonly ScaleItem[];
    readonly questionCount: number;
  };
}) {
  if (
    !(args.latestScaleVersion && args.latestScaleVersion.status === "official")
  ) {
    return null;
  }

  const latestScaleItems = yield* getScaleVersionItems(args.latestScaleVersion);

  if (
    hasPublishedScaleChanged({
      publishedItems: latestScaleItems,
      snapshotItems: args.snapshot.items,
    })
  ) {
    return null;
  }

  return args.latestScaleVersion;
});

/** Resolves whether official scale publication is ready, unchanged, or published. */
const resolveOfficialScaleDecision = Effect.fn(
  "irt.scales.resolveOfficialScaleDecision"
)(function* (args: {
  readonly latestScaleVersion: Doc<"irtScaleVersions"> | null;
  readonly now: number;
  readonly tryoutId: Id<"tryouts">;
}) {
  const snapshot = yield* getPublishableScaleSnapshot(args.tryoutId);

  if (!snapshot) {
    return { kind: "not-ready" as const };
  }

  const unchangedOfficialScale = yield* getUnchangedOfficialScaleVersion({
    latestScaleVersion: args.latestScaleVersion,
    snapshot,
  });

  if (unchangedOfficialScale) {
    return {
      kind: "unchanged" as const,
      scaleVersion: unchangedOfficialScale,
    };
  }

  const scaleVersion = yield* publishOfficialScaleVersion({
    now: args.now,
    snapshot,
    tryoutId: args.tryoutId,
  });

  if (!scaleVersion) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SCALE_VERSION_NOT_FOUND",
        message: "Published scale version could not be reloaded.",
      })
    );
  }

  return {
    kind: "published" as const,
    scaleVersion,
  };
});

/** Returns the latest usable scale version, publishing provisional or official when needed. */
export const getOrPublishScaleVersionForTryout = Effect.fn(
  "irt.scales.getOrPublishScaleVersionForTryout"
)(function* (args: { readonly now: number; readonly tryoutId: Id<"tryouts"> }) {
  const scaleQuality = yield* evaluateTryoutScaleQuality(args);
  const latestScaleVersion = yield* getLatestScaleVersionForTryout(
    args.tryoutId
  );

  if (!scaleQuality || scaleQuality.status === "blocked") {
    if (latestScaleVersion) {
      return latestScaleVersion;
    }

    return yield* publishBootstrapScaleVersion(args);
  }

  const officialScaleDecision = yield* resolveOfficialScaleDecision({
    latestScaleVersion,
    now: args.now,
    tryoutId: args.tryoutId,
  });

  if (officialScaleDecision.kind === "not-ready") {
    if (latestScaleVersion) {
      return latestScaleVersion;
    }

    return yield* publishBootstrapScaleVersion(args);
  }

  return officialScaleDecision.scaleVersion;
});

/** Publishes an official scale if ready and schedules score promotion. */
export const publishTryoutScaleVersionIfNeeded = Effect.fn(
  "irt.scales.publishTryoutScaleVersionIfNeeded"
)(function* (tryoutId: Id<"tryouts">) {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const tryout = yield* reader
    .table("tryouts")
    .get(tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryout) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_TRYOUT_NOT_FOUND",
        message: "Tryout not found for scale publication.",
      })
    );
  }

  const now = yield* Clock.currentTimeMillis;
  const scaleQuality = yield* evaluateTryoutScaleQuality({
    now,
    tryoutId: tryout._id,
  });

  if (!scaleQuality || scaleQuality.status === "blocked") {
    return { kind: "not-ready" as const };
  }

  const latestScaleVersion = yield* getLatestScaleVersionForTryout(tryout._id);
  const officialScaleDecision = yield* resolveOfficialScaleDecision({
    latestScaleVersion,
    now,
    tryoutId: tryout._id,
  });

  if (officialScaleDecision.kind === "not-ready") {
    return { kind: "not-ready" as const };
  }

  if (officialScaleDecision.kind === "unchanged") {
    return {
      kind: "unchanged" as const,
      scaleVersionId: officialScaleDecision.scaleVersion._id,
    };
  }

  const scaleVersion = officialScaleDecision.scaleVersion;
  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.tryouts.mutations.internalFunctions.scoring
      .promoteProvisionalTryoutScores,
    {
      scaleVersionId: scaleVersion._id,
      tryoutId: tryout._id,
    }
  );

  return { kind: "published" as const, scaleVersionId: scaleVersion._id };
});
