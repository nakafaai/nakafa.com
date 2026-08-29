import { afterEach, describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import * as convexRuntime from "@repo/backend/client/runtime";
import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";
import { toRuntimeQueryError } from "@repo/backend/test/runtime/query";
import { Effect, Fiber } from "effect";
import { vi } from "vitest";
import {
  getApiContentReferenceByContentId,
  getArticleApiContentPage,
  getMaterialApiContentPage,
  parseApiContentId,
  parseApiLocale,
  parseApiPageParams,
} from "@/lib/content/runtime";

const runtimeClientMocks = vi.hoisted(() => ({
  runtimeQuery: vi.fn(),
}));
const publishedContentMocks = vi.hoisted(() => ({
  readPublishedApiItems: vi.fn(),
}));

vi.spyOn(convexRuntime, "readConvexRuntimeQuery").mockImplementation(
  (url: string, query: unknown, args: unknown) =>
    Effect.tryPromise({
      catch: toRuntimeQueryError,
      try: () => runtimeClientMocks.runtimeQuery(url, query, args),
    })
);
vi.mock("@/lib/content/published", () => publishedContentMocks);
describe("API content runtime", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it("narrows supported route locales", () => {
    for (const locale of ACTIVE_APP_LOCALE_CODES) {
      expect(parseApiLocale(locale)).toBe(locale);
    }
    expect(parseApiLocale("fr")).toBeNull();
  });
  it("parses bounded page params", () => {
    expect(parseApiPageParams(new URLSearchParams())).toEqual({
      cursor: null,
      limit: 100,
    });
    expect(
      parseApiPageParams(new URLSearchParams("cursor=abc&limit=5"))
    ).toEqual({ cursor: "abc", limit: 5 });
    expect(parseApiPageParams(new URLSearchParams("limit=0"))).toBeNull();
    expect(parseApiPageParams(new URLSearchParams("limit=101"))).toBeNull();
    expect(parseApiPageParams(new URLSearchParams("limit=abc"))).toBeNull();
  });
  it("narrows graph-backed content IDs", () => {
    expect(parseApiContentId("asset:en:article:politics:article:a")).toBe(
      "asset:en:article:politics:article:a"
    );
    expect(parseApiContentId("en/articles/a")).toBeNull();
  });
  it.effect.each([
    {
      args: {
        appLocale: "en" as const,
        cursor: null,
        limit: 10,
        prefix: "articles/politics",
      },
      family: "article" as const,
      read: getArticleApiContentPage,
    },
    {
      args: {
        appLocale: "id" as const,
        cursor: "next",
        limit: 5,
        prefix: "material/lesson/mathematics",
      },
      family: "material" as const,
      read: getMaterialApiContentPage,
    },
  ])("hydrates one current signed $family page", ({ args, family, read }) =>
    Effect.gen(function* () {
      const publishedItem = { slug: `${family}/published` };
      runtimeClientMocks.runtimeQuery
        .mockResolvedValueOnce({
          activeReleaseId: "release-test",
          continueCursor: "",
          isDone: true,
          page: [
            { appLocale: args.appLocale, publicPath: `${family}/published` },
          ],
        })
        .mockResolvedValueOnce({ releaseId: "release-test" });
      publishedContentMocks.readPublishedApiItems.mockReturnValue(
        Effect.succeed([publishedItem])
      );
      expect(yield* read(args)).toEqual({
        continueCursor: "",
        isDone: true,
        page: [publishedItem],
      });
      expect(publishedContentMocks.readPublishedApiItems).toHaveBeenCalledWith([
        {
          activeReleaseId: "release-test",
          appLocale: args.appLocale,
          family,
          publicPath: `${family}/published`,
        },
      ]);
      expect(runtimeClientMocks.runtimeQuery).toHaveBeenNthCalledWith(
        1,
        "https://test.convex.cloud",
        expect.anything(),
        args
      );
    })
  );
  it.effect(
    "chunks by eight and runs at most four batch reads concurrently",
    () =>
      Effect.gen(function* () {
        const appLocale = "en";
        const entries = Array.from({ length: 33 }, (_, index) => ({
          appLocale,
          publicPath: `articles/politics/article-${index}`,
        }));
        const releaseBatch: (() => void)[] = [];
        let activeBatches = 0;
        let maximumActiveBatches = 0;
        runtimeClientMocks.runtimeQuery
          .mockResolvedValueOnce({
            activeReleaseId: "release-test",
            continueCursor: "next",
            isDone: false,
            page: entries,
          })
          .mockResolvedValueOnce({ releaseId: "release-test" });
        publishedContentMocks.readPublishedApiItems.mockImplementation(
          (
            items: readonly {
              readonly publicPath: string;
            }[]
          ) =>
            Effect.callback((resume) => {
              activeBatches += 1;
              maximumActiveBatches = Math.max(
                maximumActiveBatches,
                activeBatches
              );
              releaseBatch.push(() => {
                activeBatches -= 1;
                resume(
                  Effect.succeed(
                    items.map(({ publicPath }) => ({ slug: publicPath }))
                  )
                );
              });
            })
        );
        const running = yield* Effect.forkChild(
          getArticleApiContentPage({
            appLocale: "en",
            cursor: null,
            limit: 33,
            prefix: "articles/politics",
          })
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(releaseBatch).toHaveLength(4))
        );
        expect(maximumActiveBatches).toBe(4);
        releaseBatch.shift()?.();
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(
              publishedContentMocks.readPublishedApiItems
            ).toHaveBeenCalledTimes(5)
          )
        );
        for (const release of releaseBatch.splice(0)) {
          release();
        }
        const result = yield* Fiber.join(running);
        expect(
          publishedContentMocks.readPublishedApiItems.mock.calls.map(
            ([items]) => items.length
          )
        ).toEqual([8, 8, 8, 8, 1]);
        expect(result.page.map(({ slug }) => slug)).toEqual(
          entries.map(({ publicPath }) => publicPath)
        );
        expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledTimes(2);
      })
  );
  it.effect.each([{ releaseId: "release-after" }, null])(
    "rejects a page when its signed release changes or disappears",
    (active) =>
      Effect.gen(function* () {
        runtimeClientMocks.runtimeQuery
          .mockResolvedValueOnce({
            activeReleaseId: "release-before",
            continueCursor: "",
            isDone: true,
            page: [],
          })
          .mockResolvedValueOnce(active);
        const failure = yield* getArticleApiContentPage({
          appLocale: "en",
          cursor: null,
          limit: 10,
          prefix: "articles/politics",
        }).pipe(Effect.flip);
        expect(failure.message).toContain(
          "Content ownership changed during the public API read."
        );
      })
  );
  it.effect("maps signed hydration failures into the API runtime error", () =>
    Effect.gen(function* () {
      runtimeClientMocks.runtimeQuery.mockResolvedValueOnce({
        activeReleaseId: "release-test",
        continueCursor: "",
        isDone: true,
        page: [{ appLocale: "en", publicPath: "articles/politics/test" }],
      });
      publishedContentMocks.readPublishedApiItems.mockReturnValue(
        Effect.fail(
          new ConvexRuntimeQueryError({
            httpStatuses: [],
            networkCodes: [],
            query: "contentRuntime/batch",
            reason: "query",
          })
        )
      );
      const failure = yield* getArticleApiContentPage({
        appLocale: "en",
        cursor: null,
        limit: 10,
        prefix: "articles/politics",
      }).pipe(Effect.flip);
      expect(failure.message).toContain(
        "Unable to read signed content for the public API."
      );
    })
  );
  it.effect("reads one current reference by stable graph content ID", () =>
    Effect.gen(function* () {
      const row = { contentId: "asset:en:article:politics:article:a" };
      runtimeClientMocks.runtimeQuery.mockResolvedValueOnce(row);
      expect(
        yield* getApiContentReferenceByContentId({ contentId: row.contentId })
      ).toEqual(row);
      expect(runtimeClientMocks.runtimeQuery).toHaveBeenCalledWith(
        "https://test.convex.cloud",
        expect.anything(),
        { input: { contentId: row.contentId, kind: "content" } }
      );
    })
  );
  it.effect("wraps runtime query failures with query context", () =>
    Effect.gen(function* () {
      runtimeClientMocks.runtimeQuery.mockRejectedValueOnce(
        new ConvexRuntimeQueryError({
          httpStatuses: [],
          networkCodes: [],
          query: "contentRelease/article:apiPage",
          reason: "transport",
        })
      );
      const failure = yield* getArticleApiContentPage({
        appLocale: "en",
        cursor: null,
        limit: 10,
        prefix: "articles/politics",
      }).pipe(Effect.flip);
      expect(failure.message).toContain(
        "Unable to read API content runtime query: contentRelease/article:apiPage."
      );
    })
  );
});
