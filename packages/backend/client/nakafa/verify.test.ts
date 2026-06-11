import { verifyNakafaContent } from "@repo/backend/client/nakafa/verify";
import { api } from "@repo/backend/convex/_generated/api";
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
  locale: Schema.Literal("en", "id"),
  route: Schema.String,
});
const ExerciseGroupArgsSchema = Schema.Struct({
  category: Schema.Literal("high-school", "middle-school"),
  exerciseType: Schema.String,
  locale: Schema.Literal("en", "id"),
  material: Schema.String,
  type: Schema.String,
  year: Schema.optional(Schema.String),
});

const articleRoute = "articles/politics/example";
const exerciseGroupRoute =
  "exercises/high-school/snbt/quantitative-knowledge/try-out/2026";

beforeEach(() => {
  runtimeMocks.fetchConvexRuntimeQuery.mockReset();
  runtimeMocks.fetchConvexRuntimeQuery.mockImplementation(readRuntimeFixture);
});

describe("verifyNakafaContent", () => {
  it("verifies exact catalog routes and exercise group fallback routes", async () => {
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          `en/${articleRoute}`
        )
      )
    ).resolves.toBe(true);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          `id/${exerciseGroupRoute}`
        )
      )
    ).resolves.toBe(true);
  });

  it("returns false for invalid refs, missing rows, invalid groups, and query failures", async () => {
    await expect(
      Effect.runPromise(verifyNakafaContent("https://example.convex.cloud", ""))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          "en/subject/missing"
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent(
          "https://example.convex.cloud",
          "id/exercises/high-school/snbt/quantitative-knowledge/try-out/not-year"
        )
      )
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(
        verifyNakafaContent("https://example.convex.cloud", "en/articles/fail")
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
    getFunctionName(api.contents.queries.runtime.getContentRoute)
  ) {
    return Promise.resolve(readContentRoute(args));
  }

  if (
    getFunctionName(query) ===
    getFunctionName(api.contents.queries.runtime.getExerciseGroupPage)
  ) {
    return Promise.resolve(readExerciseGroupPage(args));
  }

  return Promise.reject(new Error("Unhandled verify query fixture."));
}

/** Builds one exact route lookup fixture from generated query args. */
function readContentRoute(args: unknown) {
  const input = Schema.decodeUnknownSync(RouteArgsSchema)(args);

  if (input.route === "articles/fail") {
    return Promise.reject(new Error("route failure"));
  }

  if (input.route === articleRoute) {
    return {
      content_id: `${input.locale}/${input.route}`,
      locale: input.locale,
      route: input.route,
      section: "articles",
      title: "Article",
    };
  }

  return null;
}

/** Builds one exercise group page fixture from generated query args. */
function readExerciseGroupPage(args: unknown) {
  const input = Schema.decodeUnknownSync(ExerciseGroupArgsSchema)(args);

  if (input.year !== "2026") {
    return null;
  }

  return {
    category: input.category,
    exerciseType: input.exerciseType,
    material: input.material,
    sets: [{ questionCount: 1, setName: "set-1", slug: "set-1" }],
    type: input.type,
    year: input.year,
  };
}
