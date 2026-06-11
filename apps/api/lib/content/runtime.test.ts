import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArticleApiContentPage,
  getExerciseApiQuestionPage,
  getExerciseApiSetPage,
  getQuranApiSurahPage,
  getSubjectApiContentPage,
  listApiStaticParams,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

const runtimeClientMocks = vi.hoisted(() => ({
  fetchConvexRuntimeQuery: vi.fn(),
}));

vi.mock("@repo/backend/client/runtime", () => ({
  fetchConvexRuntimeQuery: runtimeClientMocks.fetchConvexRuntimeQuery,
}));

describe("API content runtime", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("narrows supported route locales", () => {
    expect(parseApiLocale("en")).toBe("en");
    expect(parseApiLocale("id")).toBe("id");
    expect(parseApiLocale("fr")).toBeNull();
  });

  it("parses bounded page params", () => {
    expect(parseApiPageParams(new URLSearchParams())).toEqual({
      cursor: null,
      limit: 100,
    });
    expect(
      parseApiPageParams(new URLSearchParams("cursor=abc&limit=5"))
    ).toEqual({
      cursor: "abc",
      limit: 5,
    });
    expect(parseApiPageParams(new URLSearchParams("limit=0"))).toBeNull();
    expect(parseApiPageParams(new URLSearchParams("limit=101"))).toBeNull();
    expect(parseApiPageParams(new URLSearchParams("limit=abc"))).toBeNull();
  });

  it("reads one page for each API runtime content query", async () => {
    const articlePage = { continueCursor: "", isDone: true, page: [] };
    const subjectPage = { continueCursor: "", isDone: true, page: [] };
    const exerciseSetPage = { exercises: [] };
    const exerciseQuestionPage = { exercise: { number: 1 } };
    const quranSurahPage = { surah: { number: 1 }, verses: [] };

    runtimeClientMocks.fetchConvexRuntimeQuery
      .mockResolvedValueOnce(articlePage)
      .mockResolvedValueOnce(subjectPage)
      .mockResolvedValueOnce(exerciseSetPage)
      .mockResolvedValueOnce(exerciseQuestionPage)
      .mockResolvedValueOnce(quranSurahPage);

    await expect(
      Effect.runPromise(
        getArticleApiContentPage({
          cursor: null,
          limit: 10,
          locale: "en",
          prefix: "articles/politics",
        })
      )
    ).resolves.toEqual(articlePage);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenLastCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: null,
        limit: 10,
        locale: "en",
        prefix: "articles/politics",
      }
    );

    await expect(
      Effect.runPromise(
        getSubjectApiContentPage({
          cursor: "next",
          limit: 5,
          locale: "id",
          prefix: "subject/high-school/10/mathematics",
        })
      )
    ).resolves.toEqual(subjectPage);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenLastCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: "next",
        limit: 5,
        locale: "id",
        prefix: "subject/high-school/10/mathematics",
      }
    );

    await expect(
      Effect.runPromise(
        getExerciseApiSetPage({
          locale: "en",
          slug: "exercises/high-school/snbt/general-reasoning/set-1",
        })
      )
    ).resolves.toEqual(exerciseSetPage);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenLastCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        locale: "en",
        slug: "exercises/high-school/snbt/general-reasoning/set-1",
      }
    );

    await expect(
      Effect.runPromise(
        getExerciseApiQuestionPage({
          locale: "id",
          slug: "exercises/high-school/snbt/general-reasoning/set-1/1",
        })
      )
    ).resolves.toEqual(exerciseQuestionPage);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenLastCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        locale: "id",
        slug: "exercises/high-school/snbt/general-reasoning/set-1/1",
      }
    );

    await expect(
      Effect.runPromise(
        getQuranApiSurahPage({
          surah: 1,
        })
      )
    ).resolves.toEqual(quranSurahPage);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenLastCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        surah: 1,
      }
    );
  });

  it("wraps runtime query failures with content runtime context", async () => {
    runtimeClientMocks.fetchConvexRuntimeQuery.mockRejectedValueOnce(
      new Error("offline")
    );

    const effect = getArticleApiContentPage({
      cursor: null,
      limit: 10,
      locale: "en",
      prefix: "articles/politics",
    });

    await expect(Effect.runPromise(effect)).rejects.toThrow(
      "Unable to read API content runtime query: listArticleApiContentPage."
    );
  });

  it("maps route catalog rows into API static params", async () => {
    runtimeClientMocks.fetchConvexRuntimeQuery
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [
          {
            route: "articles/politics/dynastic-politics-asian-values",
          },
        ],
      })
      .mockResolvedValueOnce({
        continueCursor: "",
        isDone: true,
        page: [
          {
            route: "articles/politics/political-accountability",
          },
        ],
      });

    await expect(
      listApiStaticParams({
        prefix: "articles/",
        section: "articles",
      })
    ).resolves.toEqual([
      {
        locale: "en",
        slug: ["politics", "dynastic-politics-asian-values"],
      },
      {
        locale: "id",
        slug: ["politics", "political-accountability"],
      },
    ]);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenCalledTimes(2);
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: null,
        limit: 100,
        locale: "en",
        prefix: "articles/",
        section: "articles",
      }
    );
    expect(runtimeClientMocks.fetchConvexRuntimeQuery).toHaveBeenCalledWith(
      "https://test.convex.cloud",
      expect.anything(),
      {
        cursor: null,
        limit: 100,
        locale: "id",
        prefix: "articles/",
        section: "articles",
      }
    );
  });
});
