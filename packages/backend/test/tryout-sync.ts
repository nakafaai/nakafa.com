import type { BulkSyncTryoutsArgs } from "@repo/backend/convex/contentSync/tryouts/impl";
import type {
  SyncedQuestion,
  SyncedTryoutRoute,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";

const COUNTRY_ROUTE = "try-out/indonesia";
const EXAM_ROUTE = `${COUNTRY_ROUTE}/snbt`;
const TRACK_ROUTE = `${EXAM_ROUTE}/2027`;

export const SET_ROUTE = `${TRACK_ROUTE}/set-1`;
export const SECTION_ROUTE = `${SET_ROUTE}/penalaran-matematika`;
export const SECTION_SOURCE =
  "question-bank/tryout/indonesia/snbt/2027/set-1/penalaran-matematika";
export const SECTION_GRAPH = getGraphIdentity(SECTION_ROUTE);

/** Builds a minimal try-out sync payload with one section. */
export function buildSyncPayload(): BulkSyncTryoutsArgs {
  return {
    countries: [
      {
        countryKey: "indonesia",
        description: "Ujian Indonesia",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: COUNTRY_ROUTE,
        sourceRevision: "2026",
        title: "Indonesia",
      },
    ],
    exams: [
      {
        countryKey: "indonesia",
        description: "Seleksi nasional",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: EXAM_ROUTE,
        scoringStrategy: "irt",
        sourceRevision: "2026",
        title: "SNBT",
      },
    ],
    questionSets: [
      {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        description: "Penalaran matematika",
        examKey: "snbt",
        locale: "id",
        questionCount: 20,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourcePath: SECTION_SOURCE,
        sourceRevision: "2026",
        title: "Penalaran Matematika",
      },
    ],
    questions: [],
    routes: [
      buildRoute({
        description: "Ujian Indonesia",
        kind: "tryout-country",
        publicPath: COUNTRY_ROUTE,
        title: "Indonesia",
      }),
      buildRoute({
        description: "Seleksi nasional",
        kind: "tryout-exam",
        publicPath: EXAM_ROUTE,
        title: "SNBT",
      }),
      buildRoute({
        kind: "tryout-track",
        publicPath: TRACK_ROUTE,
        title: "Tahun 2027",
      }),
      buildRoute({
        kind: "tryout-set",
        publicPath: SET_ROUTE,
        title: "Set 1",
      }),
      buildRoute({
        description: "Penalaran matematika",
        kind: "tryout-section",
        publicPath: SECTION_ROUTE,
        title: "Penalaran Matematika",
      }),
    ],
    sections: [
      {
        countryKey: "indonesia",
        description: "Penalaran matematika",
        examKey: "snbt",
        locale: "id",
        order: 1,
        publicPath: SECTION_ROUTE,
        questionCount: 20,
        questionSourcePath: SECTION_SOURCE,
        sectionKey: "penalaran-matematika",
        setKey: "set-1",
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        title: "Penalaran Matematika",
        trackKey: "2027",
        visibility: "visible",
      },
    ],
    sets: [
      {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        isReady: true,
        locale: "id",
        order: 1,
        publicPath: SET_ROUTE,
        readyQuestionCount: 20,
        readyVisibleSectionCount: 1,
        scoringStrategy: "irt",
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        title: "Set 1",
        totalQuestionCount: 20,
        trackKey: "2027",
        visibleSectionCount: 1,
      },
    ],
    tracks: [
      {
        authoredSetCount: 1,
        countryKey: "indonesia",
        description: "Try-out SNBT Tahun 2027",
        examKey: "snbt",
        isActive: true,
        isReady: true,
        locale: "id",
        order: 1,
        publicPath: TRACK_ROUTE,
        readyQuestionCount: 20,
        readySetCount: 1,
        readyVisibleSectionCount: 1,
        sourceRevision: "2026",
        title: "Tahun 2027",
        trackKey: "2027",
        trackKind: "year",
      },
    ],
  };
}

/** Builds the same section as an internal entry with no public route. */
export function buildInternalEntryPayload(): BulkSyncTryoutsArgs {
  const payload = buildSyncPayload();

  return {
    ...payload,
    routes: payload.routes.filter((route) => route.kind !== "tryout-section"),
    sections: payload.sections.map(
      ({ description: _description, ...section }) => ({
        ...section,
        publicPath: undefined,
        visibility: "internal-entry",
      })
    ),
    sets: payload.sets.map((set) => ({
      ...set,
      internalEntrySectionKey: "penalaran-matematika",
      readyVisibleSectionCount: 0,
      visibleSectionCount: 0,
    })),
    tracks: payload.tracks.map((track) => ({
      ...track,
      readyVisibleSectionCount: 0,
    })),
  };
}

/** Builds the complete question payload for the one-section fixture. */
export function buildQuestions() {
  return Array.from({ length: 20 }, (_, index) => buildQuestion(index + 1));
}

/** Builds one route projection fixture matching try-out source routes. */
function buildRoute(source: {
  description?: string;
  kind: SyncedTryoutRoute["kind"];
  publicPath: string;
  title: string;
}): SyncedTryoutRoute {
  return {
    contentHash: `${source.publicPath}:hash`,
    description: source.description,
    isReady: true,
    kind: source.kind,
    locale: "id",
    publicPath: source.publicPath,
    sourcePath: source.publicPath,
    title: source.title,
  };
}

/** Builds one synced try-out question for the IRT scale snapshot. */
function buildQuestion(number: number): SyncedQuestion {
  const sourcePath = `${SECTION_SOURCE}/question-${number}`;

  return {
    answerBody: `Answer ${number}`,
    authors: [],
    choices: [
      { isCorrect: true, label: "A", optionKey: "a", order: 1 },
      { isCorrect: false, label: "B", optionKey: "b", order: 2 },
    ],
    contentHash: `question-${number}:hash`,
    date: 0,
    description: `Question ${number}`,
    locale: "id",
    number,
    questionBody: `Question ${number}`,
    questionSetSourcePath: SECTION_SOURCE,
    sourceKey: `${SECTION_SOURCE}:question-${number}`,
    sourcePath,
    sourceRevision: "2026",
    title: `Question ${number}`,
  };
}

/** Returns the graph identity for a test route. */
function getGraphIdentity(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected graph identity for ${route}.`);
  }

  return identity;
}
