import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import type {
  SyncedQuestion,
  SyncedQuestionSet,
  SyncedTryoutCountry,
  SyncedTryoutExam,
  SyncedTryoutRoute,
  SyncedTryoutSection,
  SyncedTryoutSet,
} from "@repo/backend/convex/contentSync/tryouts/spec";

/** Carries one Convex try-out sync mutation payload across all related tables. */
export interface TryoutSyncArgs {
  countries: SyncedTryoutCountry[];
  exams: SyncedTryoutExam[];
  questionSets: SyncedQuestionSet[];
  questions: SyncedQuestion[];
  routes: SyncedTryoutRoute[];
  sections: SyncedTryoutSection[];
  sets: SyncedTryoutSet[];
}

/** Groups try-out sync rows so Convex receives parents before dependents. */
export function chunkTryoutRows(rows: TryoutSyncArgs): TryoutSyncArgs[] {
  return [
    ...chunkRoutes(rows.routes),
    ...chunkCatalogRows(rows),
    ...chunkQuestionSets(rows.questionSets),
    ...chunkQuestions(rows.questions),
    ...chunkSections(rows.sections),
  ];
}

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

function chunkCatalogRows(
  rows: Pick<TryoutSyncArgs, "countries" | "exams" | "sets">
) {
  const batches: TryoutSyncArgs[] = [];
  let countryIndex = 0;
  let examIndex = 0;
  let setIndex = 0;

  while (
    countryIndex < rows.countries.length ||
    examIndex < rows.exams.length ||
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

    const sets = rows.sets.slice(setIndex, setIndex + remaining);
    batch.sets.push(...sets);
    setIndex += sets.length;

    batches.push(batch);
  }

  return batches;
}

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

function chunkSections(sections: SyncedTryoutSection[]) {
  const batches: TryoutSyncArgs[] = [];

  for (
    let index = 0;
    index < sections.length;
    index += CONTENT_SYNC_BATCH_LIMITS.tryoutSets
  ) {
    batches.push(
      createBatch({
        sections: sections.slice(
          index,
          index + CONTENT_SYNC_BATCH_LIMITS.tryoutSets
        ),
      })
    );
  }

  return batches;
}

function createBatch(values: Partial<TryoutSyncArgs>): TryoutSyncArgs {
  return {
    countries: values.countries ?? [],
    exams: values.exams ?? [],
    questionSets: values.questionSets ?? [],
    questions: values.questions ?? [],
    routes: values.routes ?? [],
    sections: values.sections ?? [],
    sets: values.sets ?? [],
  };
}
