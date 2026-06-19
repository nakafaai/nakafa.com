import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";
import { api } from "@repo/backend/convex/_generated/api";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import { LocaleSchema } from "@repo/contents/_types/content";
import { type FunctionReference, getFunctionName } from "convex/server";
import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeMocks.fetchConvexRuntimeQuery,
}));

const RouteArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  route: Schema.String,
});
const ContentIdArgsSchema = Schema.Struct({
  contentId: Schema.String,
});
const ExerciseGroupArgsSchema = Schema.Struct({
  locale: LocaleSchema,
  slug: Schema.String,
});

const articleRoute = "articles/politics/example";
const exerciseGroupRoute =
  "material/practice/assessment/snbt/quantitative-knowledge/try-out-2026";
const exerciseSetRoute = `${exerciseGroupRoute}/set-1`;
const exerciseQuestionRoute = `${exerciseSetRoute}/2`;
const publicExerciseSetRoute =
  "latihan/snbt/pengetahuan-kuantitatif/try-out/2026/set-1";
const publicExerciseQuestionRoute = `${publicExerciseSetRoute}/soal-2`;

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("verifyNakafaContent", () => {
  it("verifies exact catalog routes and readable exercise set routes", async () => {
    const articleRef = readNakafaContentRefFixture(
      "en",
      articleRoute,
      "articles"
    );

    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          articleRef.content_id
        )
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          `https://nakafa.com/id/${publicExerciseSetRoute}`
        )
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          `https://nakafa.com/id/${publicExerciseQuestionRoute}`
        )
      )
    ).resolves.toBe(true);
    expect(runtimeMocks.fetchConvexRuntimeQuery).toHaveBeenCalledWith(
      "https://example.convex.cloud",
      api.contents.queries.runtime.getContentRoute,
      {
        locale: "id",
        route: publicExerciseSetRoute,
      }
    );
  });

  it("returns false for invalid refs, missing rows, unreadable exercise routes, and query failures", async () => {
    await expect(
      Effect.runPromise(verifyNakafaContent("https://example.convex.cloud", ""))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          "https://nakafa.com/en/subjects/mathematics/topic/missing"
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          "https://nakafa.com/id/latihan/snbt/pengetahuan-kuantitatif/try-out/2026"
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          `https://nakafa.com/id/${publicExerciseSetRoute}/soal-99`
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          "https://nakafa.com/en/articles/politics/fail"
        )
      )
    ).resolves.toBe(false);
  });
});

/** Routes generated Convex query refs to verification fixtures. */
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
    getFunctionName(api.contents.queries.runtime.getExerciseSetPage)
  ) {
    return Promise.resolve(readExerciseSetPage(args));
  }

  return Promise.reject(new Error("Unhandled verify query fixture."));
}

/** Builds one route lookup fixture from a graph asset ID. */
function readContentRouteByContentId(args: unknown) {
  const input = Schema.decodeUnknownSync(ContentIdArgsSchema)(args);
  const articleRef = readNakafaContentRefFixture(
    "en",
    articleRoute,
    "articles"
  );
  const exerciseSetRef = readNakafaContentRefFixture(
    "id",
    exerciseSetRoute,
    "material"
  );
  const exerciseQuestionRef = readNakafaContentRefFixture(
    "id",
    exerciseQuestionRoute,
    "material"
  );
  const refs = [articleRef, exerciseSetRef, exerciseQuestionRef];
  const ref = refs.find((item) => item.content_id === input.contentId);

  if (!ref) {
    return null;
  }

  return {
    ...ref,
    title: ref.route,
  };
}

/** Builds one exact route lookup fixture from generated query args. */
function readContentRoute(args: unknown) {
  const input = Schema.decodeUnknownSync(RouteArgsSchema)(args);

  if (input.route === "articles/politics/fail") {
    return Promise.reject(new Error("route failure"));
  }

  if (input.route === articleRoute) {
    const ref = readNakafaContentRefFixture(
      input.locale,
      input.route,
      "articles"
    );

    return {
      ...ref,
      locale: input.locale,
      route: input.route,
      section: "articles",
      title: "Article",
    };
  }

  if (
    input.route === exerciseGroupRoute ||
    input.route === exerciseSetRoute ||
    input.route === exerciseQuestionRoute ||
    input.route === `${exerciseSetRoute}/99`
  ) {
    const ref = readNakafaContentRefFixture(
      input.locale,
      input.route,
      "material"
    );

    return {
      ...ref,
      locale: input.locale,
      route: input.route,
      section: "material",
      title: "Exercise",
    };
  }

  if (
    input.route === publicExerciseSetRoute ||
    input.route === publicExerciseQuestionRoute ||
    input.route === `${publicExerciseSetRoute}/soal-99`
  ) {
    let sourcePath = `${exerciseSetRoute}/99`;

    if (input.route === publicExerciseSetRoute) {
      sourcePath = exerciseSetRoute;
    }

    if (input.route === publicExerciseQuestionRoute) {
      sourcePath = exerciseQuestionRoute;
    }

    const ref = readNakafaContentRefFixture(
      input.locale,
      sourcePath,
      "material"
    );

    return {
      ...ref,
      locale: input.locale,
      route: input.route,
      section: "material",
      sourcePath,
      title: "Exercise",
    };
  }

  return null;
}

/** Builds one exercise set page fixture from generated query args. */
function readExerciseSetPage(args: unknown) {
  const input = Schema.decodeUnknownSync(ExerciseGroupArgsSchema)(args);

  if (input.slug !== exerciseSetRoute) {
    return null;
  }

  return {
    exercises: [{ number: 1 }, { number: 2 }],
  };
}
