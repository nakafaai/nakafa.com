// @vitest-environment node

import { HttpClient } from "@confect/js";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { FIXTURE_REVISION } from "@repo/backend/test/assessment/snapshot";
import { client } from "@repo/backend/test/client";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Layer, Option } from "effect";
import {
  readFeaturedTryout,
  readTryoutCountryPage,
  readTryoutExamPage,
  readTryoutHubPage,
  readTryoutMetadata,
  readTryoutSectionPage,
  readTryoutSetList,
  readTryoutSetPage,
  readTryoutTrackPage,
} from "@/components/tryout/catalog/source.server";
import { resetTestRuntimeCache } from "@/test/store";

const layerMock = vi.hoisted(() => vi.fn());
const fetchQueryMock = vi.hoisted(() => vi.fn());
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
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock("@/env.public", () => ({
  clientEnv: { VITE_CONVEX_URL: "https://test.convex.cloud" },
}));
vi.mock("@/env", () => ({
  env: {
    VITE_CONVEX_SITE_URL: "https://runtime.example.test",
    VITE_CONVEX_URL: "https://test.convex.cloud",
  },
}));

/** The routes of the fixture catalog in one app locale, as the fixture snapshot writes them. */
const COUNTRY = (locale: string) => `try-out/indonesia-${locale}`;
const EXAM = (locale: string) => `try-out/indonesia/snbt-${locale}`;
const TRACK = (locale: string) => `try-out/indonesia/snbt/2027-${locale}`;
const SET = (locale: string) => `try-out/indonesia/snbt/2027/set-1-${locale}`;
const SECTION = (locale: string) => `${SET(locale)}/section-a`;

beforeEach(() => {
  resetTestRuntimeCache();
  fetchQueryMock.mockReset();
});

describe("immutable try-out application catalog", () => {
  it.effect(
    "reaches Convex once for each catalog page and its metadata in a release",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        fetchQueryMock.mockImplementation(world.visitor.query);
        const readAll = () =>
          Effect.all(
            [
              readTryoutHubPage("en"),
              readTryoutCountryPage("en", COUNTRY("en")),
              readTryoutExamPage("en", EXAM("en")),
              readTryoutTrackPage("en", TRACK("en")),
              readTryoutSetPage("en", SET("en")),
              readTryoutSectionPage("en", SECTION("en")),
              readTryoutMetadata({
                appLocale: AppLocaleSchema.make("en"),
                kind: "track",
                publicPath: TRACK("en"),
              }),
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
    "serves the complete %s hierarchy and route metadata",
    (locale) =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        fetchQueryMock.mockImplementation(world.visitor.query);
        const pages = yield* Effect.all(
          [
            readTryoutHubPage(locale),
            readTryoutCountryPage(locale, COUNTRY(locale)),
            readTryoutExamPage(locale, EXAM(locale)),
            readTryoutTrackPage(locale, TRACK(locale)),
            readTryoutSetPage(locale, SET(locale)),
            readTryoutSectionPage(locale, SECTION(locale)),
          ],
          { concurrency: "unbounded" }
        );
        expect(pages[0]).toMatchObject({
          countries: [{ publicPath: COUNTRY(locale) }],
          sourceRevision: FIXTURE_REVISION,
        });
        expect(Option.getOrThrow(pages[1])).toMatchObject({
          country: { publicPath: COUNTRY(locale) },
          exams: [{ publicPath: EXAM(locale) }],
        });
        expect(pages[2]).toMatchObject({
          exam: { publicPath: EXAM(locale) },
          tracks: [{ publicPath: TRACK(locale) }],
        });
        expect(pages[3]).toMatchObject({
          track: { publicPath: TRACK(locale) },
        });
        expect(pages[4]).toMatchObject({
          sections: [
            { publicPath: SECTION(locale) },
            { publicPath: `${SET(locale)}/section-b` },
          ],
          set: { publicPath: SET(locale) },
        });
        expect(pages[5]).toMatchObject({
          section: { publicPath: SECTION(locale) },
          set: { publicPath: SET(locale) },
        });
        const metadata = yield* readTryoutMetadata({
          appLocale: AppLocaleSchema.make(locale),
          kind: "track",
          publicPath: TRACK(locale),
        });
        expect(metadata.route).toMatchObject({ publicPath: TRACK(locale) });
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
    "decodes the featured question's body with its interaction and key",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({
          firstSectionKey: "quantitative-knowledge",
        });
        fetchQueryMock.mockImplementation(world.visitor.query);

        const featured = yield* readFeaturedTryout("id");

        expect(featured.prompt.type).toBe("doc");
        expect(featured.interaction.id).toBe(featured.key?.interaction);
      })
  );
  it.effect("asks Convex for the featured question once for each release", () =>
    Effect.gen(function* () {
      const world = yield* tryoutWorld({
        firstSectionKey: "quantitative-knowledge",
      });
      fetchQueryMock.mockImplementation(world.visitor.query);

      const first = yield* readFeaturedTryout("id");
      const second = yield* readFeaturedTryout("id");

      expect(second).toEqual(first);
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
        // A deployment with no active release publishes no catalog.
        fetchQueryMock.mockImplementation(
          client(createConvexTestWithBetterAuth()).query
        );
        expect(yield* readTryoutHubPage("en").pipe(Effect.flip)).toMatchObject({
          _tag: "TryoutCatalogReadError",
        });
        expect(
          yield* readTryoutCountryPage("en", COUNTRY("en")).pipe(Effect.flip)
        ).toMatchObject({ _tag: "TryoutCatalogReadError" });
      })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
