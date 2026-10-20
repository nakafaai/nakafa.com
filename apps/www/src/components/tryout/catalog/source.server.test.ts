import { HttpClient } from "@confect/js";
import refs from "@repo/backend/confect/_generated/refs";

const layerMock = vi.hoisted(() => vi.fn());

import { decodeProtectedContentRuntimeRequest } from "@nakafa/aksara-contracts/runtime/protected/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
  PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { decodeProtectedRuntimeRow } from "@repo/backend/content/tryout/exchange";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { makeTryoutRuntimeRequest } from "@/components/tryout/content/request";
// @vitest-environment node

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import {
  APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  createTestPublication,
  makeRuntimeSource,
} from "@repo/backend/test/content/publication";
import { makeLandingSource } from "@repo/backend/test/tryout/landing";
import { makeTryoutRuntimeSource } from "@repo/backend/test/tryout/serving";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Layer, Option, Schema } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import {
  readFeaturedTryout,
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutMetadata,
  readTryoutSectionAttemptPage,
  readTryoutSectionPage,
  readTryoutSetAttemptPage,
  readTryoutSetList,
  readTryoutSetPage,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/source.server";
import { resetTestRuntimeCache } from "@/test/store";

const fetchQueryMock = vi.hoisted(() => vi.fn());
const transportMock = vi.hoisted(() => vi.fn<typeof fetch>());
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        layerMock(...args);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: fetchQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});
vi.mock(
  "@vercel/functions",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock("@/lib/content/cache", () => ({}));
vi.mock("@tanstack/react-start/rsc", () => ({
  renderServerComponent: (node: unknown) => Promise.resolve(node),
}));
vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/env", () => ({
  env: {
    VITE_CONVEX_SITE_URL: "https://runtime.example.test",
    VITE_CONVEX_URL: "https://test.convex.cloud",
  },
}));
vi.mock("@repo/site/keys", () => ({
  contentRuntimeKeys: () => ({
    CONTENT_RUNTIME_TOKEN: "technical-test-token",
  }),
}));
vi.mock("@repo/backend/content/trust", async () => {
  const { TEST_KEY_RESOLVER } = await import(
    "@repo/backend/test/content/proof"
  );
  return {
    contentKeyResolver: TEST_KEY_RESOLVER,
  };
});
vi.mock("@/lib/content/renderer/manifest", async () => {
  const { TEST_PROOF_RENDERER } = await import(
    "@repo/backend/test/content/proof"
  );
  const { Effect } = await import("effect");
  return {
    rendererManifest: Effect.succeed(TEST_PROOF_RENDERER),
  };
});
const COUNTRY = "try-out/indonesia";
const EXAM = `${COUNTRY}/tka`;
const TRACK = `${EXAM}/matematika-wajib`;
const SET = `${TRACK}/set-1`;
const SECTION = `${SET}/matematika-wajib`;
beforeEach(() => {
  resetTestRuntimeCache();
  fetchQueryMock.mockReset();
  transportMock.mockReset();
  vi.stubGlobal("fetch", transportMock);
});

/**
 * Publishes the landing question and makes the runtime endpoint answer its
 * signed artifact. Each call gets a fresh response, because a body is read
 * once.
 */
const serveFeaturedQuestion = Effect.fn("www.tryout.test.featured")(
  function* () {
    const fixture = yield* makeTryoutRuntimeSource(
      undefined,
      makeLandingSource()
    );
    const context = yield* createTestPublication(fixture.source);
    fetchQueryMock.mockImplementation(context.query);
    const selected = yield* context.query(
      refs.public.tryouts.queries.catalog.getFeaturedQuestion,
      {
        appLocale: "id",
      }
    );
    const request = yield* makeTryoutRuntimeRequest([selected.question]);
    const row = yield* context.query(
      refs.internal.contentRelease.runtime.tryout.internal.read,
      request
    );
    const found = yield* decodeProtectedRuntimeRow(
      row,
      yield* decodeProtectedContentRuntimeRequest(request)
    ).pipe(
      Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
    );
    assert.isNotNull(found);
    const body = yield* Schema.encodeEffect(JsonTextSchema)(found);
    transportMock.mockImplementation(() => {
      const response = new Response(body, {
        headers: {
          "content-type": "application/json",
          [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
        },
      });
      Object.defineProperty(response, "url", {
        value: `https://runtime.example.test${PROTECTED_CONTENT_RUNTIME_PATH}`,
      });
      return Promise.resolve(response);
    });
  }
);

describe("immutable try-out application catalog", () => {
  it.effect(
    "reaches Convex once for each catalog page and its metadata in a release",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        fetchQueryMock.mockImplementation(context.query);
        const metadataArgs = {
          appLocale: AppLocaleSchema.make("en"),
          kind: "track",
          publicPath: TRACK,
        } as const;
        const readAll = () =>
          Effect.all(
            [
              readTryoutHubPage("en"),
              readTryoutCountryPage("en", COUNTRY),
              readTryoutExamPage("en", EXAM),
              readTryoutTrackPage("en", TRACK),
              readTryoutSetPage("en", SET),
              readTryoutSectionPage("en", SECTION),
              readTryoutMetadata(metadataArgs),
            ],
            { concurrency: "unbounded" }
          );

        const first = yield* readAll();
        const second = yield* readAll();

        expect(second).toEqual(first);
        for (const ref of [
          refs.public.tryouts.queries.catalog.getHubPage,
          refs.public.tryouts.queries.catalog.getCountryPage,
          refs.public.tryouts.queries.catalog.getExamPage,
          refs.public.tryouts.queries.catalog.getTrackPage,
          refs.public.tryouts.queries.catalog.getSetPage,
          refs.public.tryouts.queries.catalog.getSectionPage,
          refs.public.tryouts.queries.catalog.getMetadata,
        ]) {
          expect(
            Arr.filter(
              fetchQueryMock.mock.calls,
              ([called]) => called.convexFunctionName === ref.convexFunctionName
            )
          ).toHaveLength(1);
        }
      })
  );
  it.effect.each(APP_LOCALE_CODES)(
    "serves the complete signed %s hierarchy and route metadata",
    (locale) =>
      Effect.gen(function* () {
        const fixture = yield* makeTryoutRuntimeSource();
        const context = yield* createTestPublication(fixture.source);
        fetchQueryMock.mockImplementation(context.query);
        const pages = yield* Effect.all(
          [
            readTryoutHubPage(locale),
            readTryoutCountryPage(locale, COUNTRY),
            readTryoutExamPage(locale, EXAM),
            readTryoutTrackPage(locale, TRACK),
            readTryoutSetPage(locale, SET),
            readTryoutSectionPage(locale, SECTION),
          ],
          { concurrency: "unbounded" }
        );
        expect(pages[0]).toMatchObject({
          countries: [
            {
              title: "Indonesia",
            },
          ],
          sourceRevision: "a".repeat(40),
        });
        expect(Option.getOrThrow(pages[1])).toMatchObject({
          country: {
            publicPath: COUNTRY,
          },
          exams: [
            {
              title: "TKA",
            },
          ],
        });
        expect(pages[2]).toMatchObject({
          exam: {
            publicPath: EXAM,
          },
          tracks: [
            {
              publicPath: TRACK,
            },
          ],
        });
        expect(pages[3]).toMatchObject({
          track: {
            publicPath: TRACK,
          },
        });
        expect(pages[4]).toMatchObject({
          set: {
            publicPath: SET,
          },
          sections: [
            {
              publicPath: SECTION,
            },
          ],
        });
        expect(pages[5]).toMatchObject({
          section: {
            publicPath: SECTION,
          },
          set: {
            publicPath: SET,
          },
        });
        const metadata = yield* readTryoutMetadata({
          appLocale: AppLocaleSchema.make(locale),
          kind: "track",
          publicPath: TRACK,
        });
        expect(metadata.route).toMatchObject({
          publicPath: TRACK,
          title: {
            en: "Compulsory Mathematics",
            id: "Matematika Wajib",
            de: "Pflichtmathematik",
          }[locale],
          alternates: Arr.map(APP_LOCALE_CODES, (appLocale) => ({
            appLocale,
            publicPath: TRACK,
          })),
        });
        expect(
          Option.isNone(yield* readTryoutCountryPage(locale, "try-out/missing"))
        ).toBe(true);
      })
  );
  it.effect(
    "keeps personalized discovery uncached and preserves transport failures",
    () =>
      Effect.gen(function* () {
        const args = {
          countryKey: "indonesia",
          examKey: "tka",
          trackKey: "matematika-wajib",
          locale: "id",
          filter: "completed",
          sort: {
            field: "durationSeconds",
            direction: "desc",
          },
          paginationOpts: {
            cursor: null,
            numItems: 25,
          },
        } as const;
        const page = {
          page: [],
          isDone: true,
          continueCursor: "",
          snapshotId: "signed",
          viewerId: "viewer",
        };
        fetchQueryMock.mockReturnValue(Effect.succeed(page));
        expect(
          yield* readTryoutSetList(Option.some("technical-token"), args)
        ).toBe(page);
        expect(fetchQueryMock).toHaveBeenCalledWith(
          refs.public.tryouts.queries.sets.list,
          args
        );
        expect(layerMock).toHaveBeenCalledWith("https://test.convex.cloud", {
          auth: "technical-token",
        });
        fetchQueryMock.mockReturnValue(
          Effect.fail(
            new HttpClient.HttpClientError({
              cause: new Error("Transport unavailable"),
            })
          )
        );
        expect(
          yield* readTryoutSetList(Option.none(), args).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "TryoutCatalogReadError",
          cause: {
            _tag: "HttpClientError",
            cause: { message: "Transport unavailable" },
          },
        });
      })
  );
  it.effect(
    "authenticates and renders the real featured question artifact",
    () =>
      Effect.gen(function* () {
        yield* serveFeaturedQuestion();
        const featured = yield* Effect.promise(() => readFeaturedTryout("id"));
        expect(renderToStaticMarkup(featured.question)).toBe(
          "Technical question"
        );
        expect(featured.response).toMatchObject({
          kind: "single-choice",
          options: [
            {
              optionKey: "option-1",
            },
            {
              optionKey: "option-2",
            },
          ],
        });
      })
  );
  it.effect("asks Convex for the featured question once for each release", () =>
    Effect.gen(function* () {
      yield* serveFeaturedQuestion();

      const first = yield* Effect.promise(() => readFeaturedTryout("id"));
      const second = yield* Effect.promise(() => readFeaturedTryout("id"));

      expect(renderToStaticMarkup(second.question)).toBe(
        renderToStaticMarkup(first.question)
      );
      expect(
        Arr.filter(
          fetchQueryMock.mock.calls,
          ([called]) =>
            called.convexFunctionName ===
            refs.public.tryouts.queries.catalog.getFeaturedQuestion
              .convexFunctionName
        )
      ).toHaveLength(1);
    })
  );
  it.effect(
    "preserves unavailable publication failures as typed catalog errors",
    () =>
      Effect.gen(function* () {
        const context = yield* createTestPublication(
          (yield* makeRuntimeSource()).source
        );
        fetchQueryMock.mockImplementation(context.query);
        const hubFailure = yield* readTryoutHubPage("en").pipe(Effect.flip);
        expect(hubFailure).toMatchObject({ _tag: "TryoutCatalogReadError" });
        const countryFailure = yield* readTryoutCountryPage("en", COUNTRY).pipe(
          Effect.flip
        );
        expect(countryFailure).toMatchObject({
          _tag: "TryoutCatalogReadError",
        });
      })
  );
  it.effect(
    "keeps absent attempt overlays and transport failures distinct",
    () =>
      Effect.gen(function* () {
        const request = {
          kind: "retained",
          attemptId: "missing-attempt",
          locale: "en",
          publicPath: SET,
        } as const;
        fetchQueryMock.mockReturnValue(Effect.succeed(null));
        expect(
          yield* readTryoutSetAttemptPage("technical-token", request)
        ).toBeNull();
        expect(
          yield* readTryoutSectionAttemptPage("technical-token", {
            ...request,
            publicPath: SECTION,
          })
        ).toBeNull();
        fetchQueryMock.mockReturnValue(
          Effect.fail(
            new HttpClient.HttpClientError({
              cause: new Error("Transport unavailable"),
            })
          )
        );
        expect(
          yield* readTryoutSetAttemptPage("technical-token", request).pipe(
            Effect.flip
          )
        ).toMatchObject({
          _tag: "TryoutCatalogReadError",
          cause: {
            _tag: "HttpClientError",
            cause: { message: "Transport unavailable" },
          },
        });
        expect(
          yield* readTryoutSectionAttemptPage("technical-token", {
            ...request,
            publicPath: SECTION,
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "TryoutCatalogReadError",
          cause: {
            _tag: "HttpClientError",
            cause: { message: "Transport unavailable" },
          },
        });
      })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
