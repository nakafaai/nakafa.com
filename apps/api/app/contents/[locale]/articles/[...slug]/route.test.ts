import { it as effectIt } from "@effect/vitest";
import { logError } from "@repo/utilities/logging/effect";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getArticleApiContentPage } from "@/lib/content/runtime";
import * as route from "./route";

const runtimeMocks = vi.hoisted(() => ({
  getArticleApiContentPage: vi.fn(),
}));
const loggingMocks = vi.hoisted(() => ({
  logError: vi.fn(),
}));

vi.mock("@repo/utilities/logging/effect", { spy: true });
vi.mocked(logError).mockImplementation((error, context) => {
  loggingMocks.logError(error, context);
  return Effect.void;
});

vi.mock("@/lib/content/runtime", { spy: true });
vi.mocked(getArticleApiContentPage).mockImplementation(
  runtimeMocks.getArticleApiContentPage
);

const articleRow = {
  description: "Political dynasty article.",
  locale: "en",
  route: "articles/politics/dynastic-politics-asian-values",
  slug: "dynastic-politics-asian-values",
  title: "Dynastic Politics",
};

describe("article content API route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads every article page at request time", () => {
    expect(route.dynamic).toBe("force-dynamic");
  });

  effectIt.effect(
    "returns the pagination envelope for default article requests",
    () =>
      Effect.gen(function* () {
        const page = {
          continueCursor: "",
          isDone: true,
          page: [articleRow],
        };

        runtimeMocks.getArticleApiContentPage.mockReturnValue(
          Effect.succeed(page)
        );

        const response = yield* Effect.promise(() =>
          route.GET(
            new Request("http://localhost/contents/en/articles/politics"),
            {
              params: Promise.resolve({
                locale: "en",
                slug: ["politics"],
              }),
            }
          )
        );

        expect(response.status).toBe(200);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual(page);
        expect(runtimeMocks.getArticleApiContentPage).toHaveBeenCalledWith({
          appLocale: "en",
          cursor: null,
          limit: 100,
          prefix: "articles/politics",
        });
      })
  );

  effectIt.effect(
    "returns the pagination envelope for explicit article pagination",
    () =>
      Effect.gen(function* () {
        const page = {
          continueCursor: "next-cursor",
          isDone: false,
          page: [articleRow],
        };

        runtimeMocks.getArticleApiContentPage.mockReturnValue(
          Effect.succeed(page)
        );

        const response = yield* Effect.promise(() =>
          route.GET(
            new Request(
              "http://localhost/contents/en/articles/politics?cursor=page-1&limit=1"
            ),
            {
              params: Promise.resolve({
                locale: "en",
                slug: ["politics"],
              }),
            }
          )
        );

        expect(response.status).toBe(200);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual(page);
        expect(runtimeMocks.getArticleApiContentPage).toHaveBeenCalledWith({
          appLocale: "en",
          cursor: "page-1",
          limit: 1,
          prefix: "articles/politics",
        });
      })
  );

  effectIt.effect("rejects invalid locales before reading Convex", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        route.GET(
          new Request("http://localhost/contents/fr/articles/politics"),
          {
            params: Promise.resolve({
              locale: "fr",
              slug: ["politics"],
            }),
          }
        )
      );

      expect(response.status).toBe(400);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({
        error: "Invalid locale. Supported locales: en, id, de.",
      });
      expect(runtimeMocks.getArticleApiContentPage).not.toHaveBeenCalled();
    })
  );

  effectIt.effect("rejects invalid pagination before reading Convex", () =>
    Effect.gen(function* () {
      const response = yield* Effect.promise(() =>
        route.GET(
          new Request(
            "http://localhost/contents/en/articles/politics?limit=101"
          ),
          {
            params: Promise.resolve({
              locale: "en",
              slug: ["politics"],
            }),
          }
        )
      );

      expect(response.status).toBe(400);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({
        error: "Invalid pagination. Limit must be between 1 and 100.",
      });
      expect(runtimeMocks.getArticleApiContentPage).not.toHaveBeenCalled();
    })
  );

  effectIt.effect("logs Convex read failures and returns an API error", () =>
    Effect.gen(function* () {
      const readError = new Error("Convex unavailable");
      runtimeMocks.getArticleApiContentPage.mockReturnValue(
        Effect.fail(readError)
      );

      const response = yield* Effect.promise(() =>
        route.GET(
          new Request("http://localhost/contents/en/articles/politics"),
          {
            params: Promise.resolve({
              locale: "en",
              slug: ["politics"],
            }),
          }
        )
      );

      expect(response.status).toBe(500);
      const body = yield* Effect.promise(() => response.json());
      expect(body).toEqual({
        error: "Failed to fetch contents.",
      });
      expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
        service: "api-contents",
        locale: "en",
        basePath: "politics",
        slugLength: 1,
        message: "Failed to fetch contents.",
      });
    })
  );

  effectIt.effect(
    "logs root article prefix failures with a readable base path",
    () =>
      Effect.gen(function* () {
        const readError = new Error("Convex unavailable");
        runtimeMocks.getArticleApiContentPage.mockReturnValue(
          Effect.fail(readError)
        );

        const response = yield* Effect.promise(() =>
          route.GET(new Request("http://localhost/contents/en/articles"), {
            params: Promise.resolve({
              locale: "en",
              slug: [],
            }),
          })
        );

        expect(response.status).toBe(500);
        const body = yield* Effect.promise(() => response.json());
        expect(body).toEqual({
          error: "Failed to fetch contents.",
        });
        expect(loggingMocks.logError).toHaveBeenCalledWith(readError, {
          service: "api-contents",
          locale: "en",
          basePath: "/",
          slugLength: 0,
          message: "Failed to fetch contents.",
        });
      })
  );
});
