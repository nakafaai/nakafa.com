import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import type {
  SyncedQuestion,
  SyncedQuestionSet,
  SyncedTryoutCountry,
  SyncedTryoutExam,
  SyncedTryoutRoute,
  SyncedTryoutSection,
  SyncedTryoutSet,
  SyncedTryoutTrack,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { Effect, Schema } from "effect";

/** Reports one stable try-out set that cannot fit in a section mutation. */
export class TryoutSectionBatchOverflowError extends Schema.TaggedError<TryoutSectionBatchOverflowError>()(
  "TryoutSectionBatchOverflowError",
  {
    limit: Schema.Number,
    message: Schema.String,
    sectionCount: Schema.Number,
    setIdentity: Schema.String,
  }
) {}

/** Carries one Convex try-out sync mutation payload across all related tables. */
export interface TryoutSyncArgs {
  countries: SyncedTryoutCountry[];
  exams: SyncedTryoutExam[];
  questionSets: SyncedQuestionSet[];
  questions: SyncedQuestion[];
  routes: SyncedTryoutRoute[];
  sections: SyncedTryoutSection[];
  sets: SyncedTryoutSet[];
  tracks: SyncedTryoutTrack[];
}

/** Groups try-out sync rows while keeping every stable set indivisible. */
export const chunkTryoutRows = Effect.fn("sync.tryouts.chunkRows")(function* (
  rows: TryoutSyncArgs
) {
  const sectionBatches = yield* chunkSections(rows.sections);

  return [
    ...chunkRoutes(rows.routes),
    ...chunkCatalogRows(rows),
    ...chunkQuestionSets(rows.questionSets),
    ...chunkQuestions(rows.questions),
    ...sectionBatches,
  ];
});

/** Split route projections into independently bounded mutation payloads. */
function chunkRoutes(routes: SyncedTryoutRoute[]) {
  const batches: TryoutSyncArgs[] = [];

  for (
    let index = 0;
    index < routes.length;
    index += CONTENT_SYNC_BATCH_LIMITS.tryoutSets
  ) {
    batches.push(
      createBatch({
        routes: routes.slice(
          index,
          index + CONTENT_SYNC_BATCH_LIMITS.tryoutSets
        ),
      })
    );
  }

  return batches;
}

/** Pack catalog parents into bounded batches while preserving source order. */
function chunkCatalogRows(
  rows: Pick<TryoutSyncArgs, "countries" | "exams" | "sets" | "tracks">
) {
  const batches: TryoutSyncArgs[] = [];
  let countryIndex = 0;
  let examIndex = 0;
  let setIndex = 0;
  let trackIndex = 0;

  while (
    countryIndex < rows.countries.length ||
    examIndex < rows.exams.length ||
    trackIndex < rows.tracks.length ||
    setIndex < rows.sets.length
  ) {
    const batch = createBatch({});
    let remaining = CONTENT_SYNC_BATCH_LIMITS.tryoutSets;

    const countries = rows.countries.slice(
      countryIndex,
      countryIndex + remaining
    );
    batch.countries.push(...countries);
    countryIndex += countries.length;
    remaining -= countries.length;

    const exams = rows.exams.slice(examIndex, examIndex + remaining);
    batch.exams.push(...exams);
    examIndex += exams.length;
    remaining -= exams.length;

    const tracks = rows.tracks.slice(trackIndex, trackIndex + remaining);
    batch.tracks.push(...tracks);
    trackIndex += tracks.length;
    remaining -= tracks.length;

    const sets = rows.sets.slice(setIndex, setIndex + remaining);
    batch.sets.push(...sets);
    setIndex += sets.length;

    batches.push(batch);
  }

  return batches;
}

/** Split question-set rows at the configured transactional limit. */
function chunkQuestionSets(questionSets: SyncedQuestionSet[]) {
  const batches: TryoutSyncArgs[] = [];

  for (
    let index = 0;
    index < questionSets.length;
    index += CONTENT_SYNC_BATCH_LIMITS.questionSets
  ) {
    batches.push(
      createBatch({
        questionSets: questionSets.slice(
          index,
          index + CONTENT_SYNC_BATCH_LIMITS.questionSets
        ),
      })
    );
  }

  return batches;
}

/** Split question rows at the configured transactional limit. */
function chunkQuestions(questions: SyncedQuestion[]) {
  const batches: TryoutSyncArgs[] = [];

  for (
    let index = 0;
    index < questions.length;
    index += CONTENT_SYNC_BATCH_LIMITS.questions
  ) {
    batches.push(
      createBatch({
        questions: questions.slice(
          index,
          index + CONTENT_SYNC_BATCH_LIMITS.questions
        ),
      })
    );
  }

  return batches;
}

/** Packs complete stable-set section groups within the transaction limit. */
const chunkSections = Effect.fn("sync.tryouts.chunkSections")(function* (
  sections: SyncedTryoutSection[]
) {
  const batches: TryoutSyncArgs[] = [];
  const groups = groupSections(sections);
  let batch = createBatch({});

  for (const [setIdentity, group] of groups) {
    if (group.length > CONTENT_SYNC_BATCH_LIMITS.tryoutSets) {
      return yield* new TryoutSectionBatchOverflowError({
        limit: CONTENT_SYNC_BATCH_LIMITS.tryoutSets,
        message: `Try-out set ${setIdentity} has ${group.length} sections; the mutation limit is ${CONTENT_SYNC_BATCH_LIMITS.tryoutSets}.`,
        sectionCount: group.length,
        setIdentity,
      });
    }

    if (
      batch.sections.length > 0 &&
      batch.sections.length + group.length >
        CONTENT_SYNC_BATCH_LIMITS.tryoutSets
    ) {
      batches.push(batch);
      batch = createBatch({});
    }

    batch.sections.push(...group);
  }

  if (batch.sections.length > 0) {
    batches.push(batch);
  }

  return batches;
});

/** Groups section rows by the canonical locale-specific set identity. */
function groupSections(sections: readonly SyncedTryoutSection[]) {
  const groups = new Map<string, SyncedTryoutSection[]>();

  for (const section of sections) {
    const setIdentity = tryoutCatalogIdentity({
      countryKey: section.countryKey,
      examKey: section.examKey,
      kind: "set",
      locale: section.locale,
      setKey: section.setKey,
      trackKey: section.trackKey,
    });
    const group = groups.get(setIdentity);

    if (group) {
      group.push(section);
      continue;
    }

    groups.set(setIdentity, [section]);
  }

  return groups;
}

/** Fill omitted try-out sync collections with empty arrays. */
function createBatch(values: Partial<TryoutSyncArgs>): TryoutSyncArgs {
  return {
    countries: values.countries ?? [],
    exams: values.exams ?? [],
    questionSets: values.questionSets ?? [],
    questions: values.questions ?? [],
    routes: values.routes ?? [],
    sections: values.sections ?? [],
    sets: values.sets ?? [],
    tracks: values.tracks ?? [],
  };
}
