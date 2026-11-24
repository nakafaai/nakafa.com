import { PlacedVersionSchema } from "@nakafa/aksara-contracts/assessment/paper";
import { ScoringStrategySchema } from "@nakafa/aksara-contracts/assessment/scoring";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import tryoutsInternal from "@repo/backend/confect/_generated/refs/tryouts.server";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationRunner,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadActiveAssessment } from "@repo/backend/confect/tryouts/active";
import type {
  RepinPageArgs,
  RepinPhase,
  RepinReceipt,
  RepinRunArgs,
} from "@repo/backend/confect/tryouts/repin/spec";
import { loadAttemptPlacements } from "@repo/backend/confect/tryouts/runtime/placement";
import { placedQuestionFields } from "@repo/backend/confect/tryouts/runtime/question";
import type { FrozenPlacement } from "@repo/backend/confect/tryouts/start/freeze";
import { freezeAttempt } from "@repo/backend/confect/tryouts/start/freeze";
import { selectAttemptScale } from "@repo/backend/confect/tryouts/start/scale";
import type { TryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import { loadTryoutStartSource } from "@repo/backend/confect/tryouts/start/source";
import {
  Array as Arr,
  Effect,
  HashMap,
  MutableHashMap,
  Option,
  Schema,
  Tuple,
} from "effect";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 25;
const DEFAULT_MAX_PAGES = 64;
const MAX_PAGES = 128;

const StoredQuestionSchema = Schema.Struct(placedQuestionFields);
const sameStoredQuestionStruct = Schema.toEquivalence(StoredQuestionSchema);
const sameScoring = Schema.toEquivalence(ScoringStrategySchema);
const sameVersions = Schema.toEquivalence(
  Schema.NonEmptyArray(PlacedVersionSchema)
);

type ActiveTarget = Effect.Success<ReturnType<typeof loadActiveAssessment>>;

type FrozenSet = readonly [
  source: TryoutStartSource,
  placementsByKey: HashMap.HashMap<string, FrozenPlacement>,
];

type StoredQuestionRow = Pick<
  Docs["tryoutAttemptPlacements"],
  "interactionJson" | "keyJson" | "laterInteractions" | "rule"
>;

/** Bounds an optional integer page or batch limit to a safe inclusive range. */
function clampPositive(
  value: number | undefined,
  fallback: number,
  max: number
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.trunc(value)));
}

/** Projects a stored row onto its frozen grading fields for structural comparison. */
function storedQuestionOf(
  row: StoredQuestionRow
): typeof StoredQuestionSchema.Type {
  return {
    interactionJson: row.interactionJson,
    keyJson: row.keyJson,
    rule: row.rule,
    ...(row.laterInteractions === undefined
      ? {}
      : { laterInteractions: row.laterInteractions }),
  };
}

/** Checks that every interaction of a frozen question matches its active replacement verbatim. */
function sameStoredQuestion(
  current: StoredQuestionRow,
  next: FrozenPlacement
): boolean {
  return sameStoredQuestionStruct(
    storedQuestionOf(current),
    storedQuestionOf(next)
  );
}

/** Builds a stable lookup key for one placed item family inside one section. */
function placementKey(sectionKey: string, family: string): string {
  return `${sectionKey}:${family}`;
}

/** Loads and caches the active snapshot's frozen paper for one set and app locale. */
const loadFrozenSet = Effect.fn("tryouts.repin.loadFrozenSet")(function* (
  cache: MutableHashMap.MutableHashMap<string, Option.Option<FrozenSet>>,
  active: ActiveTarget,
  target: {
    readonly appLocale: Docs["tryoutAttempts"]["appLocale"];
    readonly countryKey: Docs["tryoutAttempts"]["countryKey"];
    readonly examKey: Docs["tryoutAttempts"]["examKey"];
    readonly setKey: Docs["tryoutAttempts"]["setKey"];
    readonly trackKey: Docs["tryoutAttempts"]["trackKey"];
  }
) {
  const key = `${target.countryKey}/${target.examKey}/${target.trackKey}/${target.setKey}:${target.appLocale}`;
  const cached = MutableHashMap.get(cache, key);
  if (Option.isSome(cached)) {
    return cached.value;
  }
  const loaded = yield* Effect.option(
    loadTryoutStartSource(active, {
      countryKey: target.countryKey,
      examKey: target.examKey,
      locale: target.appLocale,
      setKey: target.setKey,
      trackKey: target.trackKey,
    }).pipe(
      Effect.flatMap((source) =>
        freezeAttempt({
          items: source.items,
          paper: source.paper.paper,
          profile: source.profile.profile,
          sections: source.sections,
        }).pipe(
          Effect.map(
            (frozen): FrozenSet =>
              Tuple.make(
                source,
                HashMap.fromIterable(
                  Arr.map(frozen.placements, (place) =>
                    Tuple.make(
                      placementKey(place.sectionKey, place.family),
                      place
                    )
                  )
                )
              )
          )
        )
      )
    )
  );
  MutableHashMap.set(cache, key, loaded);
  return loaded;
});

/** Re-pins one compatible try-out attempt and its placements, score, and IRT scale. */
const repinAttempt = Effect.fn("tryouts.repin.attempt")(function* (
  cache: MutableHashMap.MutableHashMap<string, Option.Option<FrozenSet>>,
  active: ActiveTarget,
  attempt: Docs["tryoutAttempts"]
) {
  const frozen = yield* loadFrozenSet(cache, active, attempt);
  if (Option.isNone(frozen)) {
    return "skipped" as const;
  }
  const [source, placementsByKey] = frozen.value;
  if (!sameScoring(attempt.scoring, source.profile.profile.scoring)) {
    return "skipped" as const;
  }
  const placements = yield* loadAttemptPlacements(attempt).pipe(Effect.orDie);
  const matched = Option.all(
    Arr.map(placements, (placement) =>
      Option.filter(
        HashMap.get(
          placementsByKey,
          placementKey(placement.sectionKey, placement.family)
        ),
        (candidate) => sameStoredQuestion(placement, candidate)
      ).pipe(Option.map((next) => Tuple.make(placement, next)))
    )
  );
  if (Option.isNone(matched)) {
    return "skipped" as const;
  }
  let nextScaleId: Docs["tryoutAttempts"]["scaleVersionId"];
  if (attempt.scaleVersionId !== undefined) {
    const scale = Option.flatMap(
      yield* Effect.option(selectAttemptScale(source, attempt.startedAt)),
      Option.fromNullishOr
    );
    if (Option.isNone(scale)) {
      return "skipped" as const;
    }
    nextScaleId = scale.value._id;
  }
  const writer = yield* DatabaseWriter;
  for (const [placement, next] of matched.value) {
    if (!sameVersions(placement.versions, next.versions)) {
      yield* writer
        .table("tryoutAttemptPlacements")
        .patch(placement._id, { versions: next.versions })
        .pipe(Effect.orDie);
    }
  }
  yield* writer
    .table("tryoutAttempts")
    .patch(attempt._id, {
      assessmentSnapshotId: active.snapshotId,
      paper: { hash: source.paper.hash, id: source.paper.paper.id },
      profile: { hash: source.profile.hash, id: source.profile.profile.id },
      releaseId: active.releaseId,
      ...(nextScaleId === undefined ? {} : { scaleVersionId: nextScaleId }),
    })
    .pipe(Effect.orDie);
  const score = yield* (yield* DatabaseReader)
    .table("tryoutScores")
    .index("by_tryoutAttemptId", (query) =>
      query.eq("tryoutAttemptId", attempt._id)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(score)) {
    yield* writer
      .table("tryoutScores")
      .patch(score.value._id, {
        assessmentSnapshotId: active.snapshotId,
        ...(nextScaleId === undefined ? {} : { scaleVersionId: nextScaleId }),
      })
      .pipe(Effect.orDie);
  }
  return "repinned" as const;
});

/** Re-pins one compatible practice session and its frozen question versions. */
const repinSession = Effect.fn("tryouts.repin.session")(function* (
  cache: MutableHashMap.MutableHashMap<string, Option.Option<FrozenSet>>,
  active: ActiveTarget,
  session: Docs["practiceSessions"]
) {
  const frozen = yield* loadFrozenSet(cache, active, session);
  if (Option.isNone(frozen)) {
    return "skipped" as const;
  }
  const [source, placementsByKey] = frozen.value;
  const questions = yield* (yield* DatabaseReader)
    .table("practiceQuestions")
    .index("by_practiceSessionId_and_questionOrder", (query) =>
      query.eq("practiceSessionId", session._id)
    )
    .take(session.questionCount + 1)
    .pipe(Effect.orDie);
  const matched = Option.all(
    Arr.map(questions, (question) =>
      Option.filter(
        HashMap.get(
          placementsByKey,
          placementKey(session.sectionKey, question.family)
        ),
        (candidate) =>
          sameStoredQuestion(question, candidate) &&
          Arr.some(
            candidate.versions,
            ({ language }) => language === session.questionLanguage
          )
      ).pipe(Option.map((next) => Tuple.make(question, next)))
    )
  );
  if (Option.isNone(matched)) {
    return "skipped" as const;
  }
  const writer = yield* DatabaseWriter;
  for (const [question, next] of matched.value) {
    if (!sameVersions(question.versions, next.versions)) {
      yield* writer
        .table("practiceQuestions")
        .patch(question._id, { versions: next.versions })
        .pipe(Effect.orDie);
    }
  }
  yield* writer
    .table("practiceSessions")
    .patch(session._id, {
      assessmentSnapshotId: active.snapshotId,
      paper: { hash: source.paper.hash, id: source.paper.paper.id },
      releaseId: active.releaseId,
    })
    .pipe(Effect.orDie);
  return "repinned" as const;
});

/** Re-pins one bounded page of attempts or practice sessions from a retired snapshot onto the active snapshot. */
export const repinSnapshotPage = Effect.fn("tryouts.repin.page")(function* (
  args: RepinPageArgs
) {
  const active = yield* loadActiveAssessment();
  if (args.fromSnapshotId === active.snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Snapshot ${args.fromSnapshotId} is already the active assessment snapshot.`
    );
  }
  const numItems = clampPositive(
    args.batchSize,
    DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE
  );
  const phase: RepinPhase = args.phase ?? "attempts";
  const cursor = args.cursor ?? null;
  const cache = MutableHashMap.empty<string, Option.Option<FrozenSet>>();
  const database = yield* DatabaseReader;
  if (phase === "attempts") {
    const page = yield* database
      .table("tryoutAttempts")
      .index("by_assessmentSnapshotId", (query) =>
        query.eq("assessmentSnapshotId", args.fromSnapshotId)
      )
      .paginate({ cursor, numItems })
      .pipe(Effect.orDie);
    let repinnedAttempts = 0;
    let skippedAttempts = 0;
    for (const attempt of page.page) {
      const outcome = yield* repinAttempt(cache, active, attempt);
      if (outcome === "repinned") {
        repinnedAttempts += 1;
      } else {
        skippedAttempts += 1;
      }
    }
    return {
      cursor: page.isDone ? null : page.continueCursor,
      done: false,
      phase: page.isDone ? "sessions" : "attempts",
      repinnedAttempts,
      repinnedSessions: 0,
      skippedAttempts,
      skippedSessions: 0,
      targetSnapshotId: active.snapshotId,
    } satisfies RepinReceipt;
  }
  const page = yield* database
    .table("practiceSessions")
    .index("by_assessmentSnapshotId", (query) =>
      query.eq("assessmentSnapshotId", args.fromSnapshotId)
    )
    .paginate({ cursor, numItems })
    .pipe(Effect.orDie);
  let repinnedSessions = 0;
  let skippedSessions = 0;
  for (const session of page.page) {
    const outcome = yield* repinSession(cache, active, session);
    if (outcome === "repinned") {
      repinnedSessions += 1;
    } else {
      skippedSessions += 1;
    }
  }
  return {
    cursor: page.isDone ? null : page.continueCursor,
    done: page.isDone,
    phase: "sessions",
    repinnedAttempts: 0,
    repinnedSessions,
    skippedAttempts: 0,
    skippedSessions,
    targetSnapshotId: active.snapshotId,
  } satisfies RepinReceipt;
});

/** Drives bounded re-pin pages across attempts and practice sessions until exhausted or capped. */
export const runRepinSnapshot = Effect.fn("tryouts.repin.run")(function* (
  args: RepinRunArgs
) {
  const { runMutation } = yield* MutationRunner;
  const maxPages = clampPositive(args.maxPages, DEFAULT_MAX_PAGES, MAX_PAGES);
  let phase: RepinPhase = "attempts";
  let cursor: null | string = null;
  let repinnedAttempts = 0;
  let repinnedSessions = 0;
  let skippedAttempts = 0;
  let skippedSessions = 0;
  let targetSnapshotId = "";
  let done = false;
  for (let index = 0; index < maxPages; index += 1) {
    const receipt: RepinReceipt = yield* runMutation(
      tryoutsInternal.mutations.repin.page,
      {
        ...(args.batchSize === undefined ? {} : { batchSize: args.batchSize }),
        cursor,
        fromSnapshotId: args.fromSnapshotId,
        phase,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    repinnedAttempts += receipt.repinnedAttempts;
    repinnedSessions += receipt.repinnedSessions;
    skippedAttempts += receipt.skippedAttempts;
    skippedSessions += receipt.skippedSessions;
    targetSnapshotId = receipt.targetSnapshotId;
    phase = receipt.phase;
    cursor = receipt.cursor;
    done = receipt.done;
    if (done) {
      break;
    }
  }
  return {
    cursor,
    done,
    phase,
    repinnedAttempts,
    repinnedSessions,
    skippedAttempts,
    skippedSessions,
    targetSnapshotId,
  } satisfies RepinReceipt;
});
