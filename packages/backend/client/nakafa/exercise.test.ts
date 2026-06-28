import {
  getExerciseGroupArgs,
  readExerciseMarkdown,
  readNakafaExercise,
} from "@repo/backend/client/nakafa/exercise";
import { api } from "@repo/backend/convex/_generated/api";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { createNakafaContentRefFromGraphProjection } from "@repo/contents/_lib/agent/refs";
import { LocaleSchema } from "@repo/contents/_types/content";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Option, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const ExerciseSetArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  slug: Schema.String,
});
const ContentRouteArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  route: Schema.String,
});
const SourcePathArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  sourcePath: Schema.String,
});
const ContentIdArgsSchema = Schema.Struct({
  contentId: Schema.String,
});

const convexUrl = "https://example.convex.cloud";
const setRoute =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-1";
const missingSetRoute =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026/set-missing";
const detachedSetRef = detachedExerciseRef(
  "asset:id:catalog:exercise:set-1",
  setRoute
);
const detachedQuestionRef = detachedExerciseRef(
  "asset:id:catalog:exercise:set-1:q2",
  `${setRoute}/2`
);

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("readNakafaExercise", () => {
  it("reads full exercise sets and specific questions from Convex rows", async () => {
    const setRef = readNakafaContentRefFixture("id", setRoute, "material");
    const set = await Effect.runPromise(
      readNakafaExercise(convexUrl, setRef.content_id)
    );
    const explicitQuestion = await Effect.runPromise(
      readNakafaExercise(convexUrl, setRef.content_id, 2)
    );
    const questionRef = readNakafaContentRefFixture(
      "id",
      `${setRoute}/2`,
      "material"
    );
    const graphQuestion = await Effect.runPromise(
      readNakafaExercise(convexUrl, questionRef.content_id)
    );
    const markdown = await Effect.runPromise(
      readExerciseMarkdown(
        convexUrl,
        readNakafaContentRefFixture("id", setRoute, "material")
      )
    );

    expect(Option.getOrUndefined(set)?.count).toBe(2);
    expect(Option.getOrUndefined(explicitQuestion)?.exercise_number).toBe(2);
    expect(Option.getOrUndefined(explicitQuestion)?.content_id).toBe(
      detachedQuestionRef.content_id
    );
    expect(Option.getOrUndefined(explicitQuestion)?.route).toBe(
      detachedQuestionRef.route
    );
    expect(Option.getOrUndefined(explicitQuestion)?.url).toBe(
      "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-2"
    );
    expect(Option.getOrUndefined(graphQuestion)?.exercise_number).toBe(2);
    expect(Option.getOrUndefined(markdown)?.text).toContain("- [x] A. Benar");
  });

  it("preserves catalog graph identity in exercise results", async () => {
    const set = await Effect.runPromise(
      readNakafaExercise(convexUrl, detachedSetRef.content_id)
    );
    const selectedQuestion = await Effect.runPromise(
      readNakafaExercise(convexUrl, detachedSetRef.content_id, 2)
    );
    const question = await Effect.runPromise(
      readNakafaExercise(convexUrl, detachedQuestionRef.content_id)
    );
    const matchingQuestion = await Effect.runPromise(
      readNakafaExercise(convexUrl, detachedQuestionRef.content_id, 2)
    );
    const sourceProjectionSet = readNakafaContentRefFixture(
      "id",
      setRoute,
      "material"
    );

    expect(Option.getOrUndefined(set)?.content_id).toBe(
      detachedSetRef.content_id
    );
    expect(Option.getOrUndefined(question)?.content_id).toBe(
      detachedQuestionRef.content_id
    );
    expect(Option.getOrUndefined(selectedQuestion)?.content_id).toBe(
      detachedQuestionRef.content_id
    );
    expect(Option.getOrUndefined(selectedQuestion)?.route).toBe(
      detachedQuestionRef.route
    );
    expect(Option.getOrUndefined(selectedQuestion)?.url).toBe(
      "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-2"
    );
    expect(Option.getOrUndefined(question)?.exercise_number).toBe(2);
    expect(Option.getOrUndefined(matchingQuestion)?.content_id).toBe(
      detachedQuestionRef.content_id
    );
    expect(Option.getOrUndefined(matchingQuestion)?.exercise_number).toBe(2);
    expect(Option.getOrUndefined(set)?.content_id).not.toBe(
      sourceProjectionSet.content_id
    );
    expect(Option.getOrUndefined(question)?.content_id).not.toBe(
      sourceProjectionSet.content_id
    );
  });

  it("rejects conflicting question refs and explicit exercise numbers", async () => {
    const conflict = await Effect.runPromise(
      readNakafaExercise(convexUrl, detachedQuestionRef.content_id, 1)
    );

    expect(Option.isNone(conflict)).toBe(true);
  });

  it("returns none for unsupported, missing, and malformed exercise refs", async () => {
    const articleRef = readNakafaContentRefFixture(
      "id",
      "articles/politics/example",
      "articles"
    );
    const missingSetRef = readNakafaContentRefFixture(
      "id",
      missingSetRoute,
      "material"
    );
    const unsupported = await Effect.runPromise(
      readNakafaExercise(convexUrl, articleRef.content_id)
    );
    const missingSet = await Effect.runPromise(
      readNakafaExercise(convexUrl, missingSetRef.content_id)
    );
    const setRef = readNakafaContentRefFixture("id", setRoute, "material");
    const missingQuestion = await Effect.runPromise(
      readNakafaExercise(convexUrl, setRef.content_id, 99)
    );
    const malformedQuestion = await Effect.runPromise(
      readNakafaExercise(
        convexUrl,
        `https://nakafa.com/id/${setRoute}/question-two`
      )
    );
    const nonSetParent = await Effect.runPromise(
      readNakafaExercise(
        convexUrl,
        "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/soal-2"
      )
    );
    const missingMarkdown = await Effect.runPromise(
      readExerciseMarkdown(
        convexUrl,
        readNakafaContentRefFixture("id", missingSetRoute, "material")
      )
    );

    expect(Option.isNone(unsupported)).toBe(true);
    expect(Option.isNone(missingSet)).toBe(true);
    expect(Option.isNone(missingQuestion)).toBe(true);
    expect(Option.isNone(malformedQuestion)).toBe(true);
    expect(Option.isNone(nonSetParent)).toBe(true);
    expect(Option.isNone(missingMarkdown)).toBe(true);
  });

  it("parses valid exercise group routes and rejects invalid route shapes", () => {
    expect(
      Option.getOrUndefined(
        getExerciseGroupArgs(
          "id",
          "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026"
        )
      )
    ).toMatchObject({
      material: "quantitative-knowledge",
      year: "2026",
    });
    expect(
      Option.isNone(
        getExerciseGroupArgs("id", "material/practice/assessment/snbt")
      )
    ).toBe(true);
    expect(
      Option.isNone(
        getExerciseGroupArgs(
          "id",
          "articles/high-school/snbt/quantitative-knowledge/try-out"
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        getExerciseGroupArgs(
          "id",
          "material/practice/assessment/snbt/not-a-material/try-out"
        )
      )
    ).toBe(true);
    expect(
      Option.isNone(
        getExerciseGroupArgs(
          "id",
          "material/practice/assessment/snbt/quantitative-knowledge/try-out/not-year"
        )
      )
    ).toBe(true);
  });
});

/** Routes generated Convex query refs to exercise reader fixtures. */
function readRuntimeFixture(
  _convexUrl: string,
  query: FunctionReference<"query">,
  args: unknown
) {
  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getContentRouteByContentId)
  ) {
    return Promise.resolve(readContentRouteByContentId(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getContentRoute)
  ) {
    return Promise.resolve(readContentRoute(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getContentRouteBySourcePath)
  ) {
    return Promise.resolve(readContentRouteBySourcePath(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getExerciseSetPage)
  ) {
    return Promise.resolve(readExerciseSetPage(args));
  }

  return Promise.reject(new Error("Unhandled exercise query fixture."));
}

/** Builds one route lookup fixture from the persisted route catalog. */
function readContentRoute(args: unknown) {
  const input = Schema.decodeUnknownSync(ContentRouteArgsSchema)(args);
  const refs = [
    detachedSetRef,
    detachedQuestionRef,
    readNakafaContentRefFixture("id", "articles/politics/example", "articles"),
  ];
  const ref = refs.find(
    (item) => item.locale === input.locale && item.route === input.route
  );

  if (!ref) {
    return null;
  }

  return {
    ...ref,
    title: ref.route,
  };
}

/** Builds one source-path lookup fixture from the persisted route catalog. */
function readContentRouteBySourcePath(args: unknown) {
  const input = Schema.decodeUnknownSync(SourcePathArgsSchema)(args);
  const refs = [detachedSetRef, detachedQuestionRef];
  const ref = refs.find(
    (item) => item.locale === input.locale && item.route === input.sourcePath
  );

  if (!ref) {
    return null;
  }

  return {
    ...ref,
    route: `latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-${input.sourcePath.split("/").at(-1)}`,
    sourcePath: ref.route,
    title: ref.route,
  };
}

/** Builds one route lookup fixture from a graph asset ID. */
function readContentRouteByContentId(args: unknown) {
  const input = Schema.decodeUnknownSync(ContentIdArgsSchema)(args);
  const setRef = readNakafaContentRefFixture("id", setRoute, "material");
  const questionRef = readNakafaContentRefFixture(
    "id",
    `${setRoute}/2`,
    "material"
  );
  const articleRef = readNakafaContentRefFixture(
    "id",
    "articles/politics/example",
    "articles"
  );
  const missingSetRef = readNakafaContentRefFixture(
    "id",
    missingSetRoute,
    "material"
  );
  const refs = [
    setRef,
    questionRef,
    articleRef,
    missingSetRef,
    detachedSetRef,
    detachedQuestionRef,
  ];
  const ref = refs.find((item) => item.content_id === input.contentId);

  if (!ref) {
    return null;
  }

  return {
    ...ref,
    title: ref.route,
  };
}

/** Creates a graph ref whose IDs intentionally do not derive from its route. */
function detachedExerciseRef(contentId: string, route: string) {
  const ref = createNakafaContentRefFromGraphProjection({
    alignmentId: contentId.replace("asset:", "alignment:"),
    assetId: contentId,
    conceptId: contentId.replace("asset:", "concept:"),
    content_id: contentId,
    learningObjectId: contentId.replace("asset:", "lo:"),
    lensId: contentId.replace("asset:", "lens:"),
    locale: "id",
    route,
    section: "material",
  });

  if (Option.isNone(ref)) {
    throw new Error("Expected a valid detached exercise graph ref.");
  }

  return ref.value;
}

/** Builds one exercise set page fixture from generated query args. */
function readExerciseSetPage(args: unknown) {
  const input = Schema.decodeUnknownSync(ExerciseSetArgsSchema)(args);

  if (input.slug !== setRoute) {
    return null;
  }

  return {
    category: "high-school",
    description: "Exercise description",
    exerciseType: "try-out",
    exercises: [exerciseItem(1), exerciseItem(2)],
    material: "quantitative-knowledge",
    questionCount: 2,
    setName: "set-1",
    slug: setRoute,
    syncedAt: 1,
    title: "Exercise Set",
    type: "snbt",
    year: "2026",
  };
}

/** Builds one localized exercise question fixture. */
function exerciseItem(number: number) {
  return {
    answer: {
      metadata: { authors: [], date: "2025-01-01", title: `Answer ${number}` },
      raw: `Answer raw ${number}`,
    },
    choices: {
      en: [
        { label: "A. Correct", value: true },
        { label: "B. Incorrect", value: false },
      ],
      id: [
        { label: "A. Benar", value: true },
        { label: "B. Salah", value: false },
      ],
    },
    contentHash: `question-${number}`,
    number,
    question: {
      metadata: {
        authors: [],
        date: "2025-01-01",
        title: `Question ${number}`,
      },
      raw: `Question raw ${number}`,
    },
  };
}
