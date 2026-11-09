// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { CatalogQuery } from "@/components/tryout/catalog/table/query";
import {
  readTryoutCountryRoute,
  readTryoutGroupRoute,
  readTryoutHubHandler,
  readTryoutHubRoute,
  readTryoutTrackRoute,
  readTryoutTrackSetList,
} from "@/components/tryout/route/catalog.server";

const catalog = vi.hoisted(() => ({
  buildTryoutCountryOptions: vi.fn(),
  buildTryoutExamOptions: vi.fn(),
  buildTryoutGroupOptions: vi.fn(),
  getAppSocialArtwork: vi.fn(),
  getOgUrl: vi.fn(),
  readServerTranslator: vi.fn(),
  readTryoutCountryPage: vi.fn(),
  readTryoutGroupPage: vi.fn(),
  readTryoutHubPage: vi.fn(),
  readTryoutMetadata: vi.fn(),
  readTryoutSetList: vi.fn(),
  readTryoutTrackPage: vi.fn(),
  resolveTryoutExamArtwork: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/try-out"),
}));
vi.mock("@/components/tryout/catalog/options", () => ({
  buildTryoutCountryOptions: catalog.buildTryoutCountryOptions,
  buildTryoutExamOptions: catalog.buildTryoutExamOptions,
  buildTryoutGroupOptions: catalog.buildTryoutGroupOptions,
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutCountryPage: catalog.readTryoutCountryPage,
  readTryoutGroupPage: catalog.readTryoutGroupPage,
  readTryoutHubPage: catalog.readTryoutHubPage,
  readTryoutMetadata: catalog.readTryoutMetadata,
  readTryoutSetList: catalog.readTryoutSetList,
  readTryoutTrackPage: catalog.readTryoutTrackPage,
}));
vi.mock("@/lib/og/app", () => ({
  getAppSocialArtwork: catalog.getAppSocialArtwork,
}));
vi.mock("@/lib/seo/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/social")>()),
  getOgUrl: catalog.getOgUrl,
}));
vi.mock("@/lib/tryout/artwork", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tryout/artwork")>()),
  resolveTryoutExamArtwork: catalog.resolveTryoutExamArtwork,
}));
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: catalog.readServerTranslator,
}));

const COUNTRY = "try-out/id";
const EXAM = "try-out/id/snbt";
const GROUP = "try-out/id/snbt/2027";
const TRACK = "try-out/id/snbt/2027/utbk";

const countryPage = {
  country: { countryKey: "id" },
  exams: [
    { examKey: "snbt", imageKey: "exam-a", publicPath: EXAM, title: "SNBT" },
    {
      examKey: "utbk",
      imageKey: "exam-b",
      publicPath: "try-out/id/utbk",
      title: "UTBK",
    },
  ],
  sourceRevision: "2026-10-02",
};
const groups = [{ groupKey: "2027", publicPath: GROUP, title: "2027" }];
const groupPage = {
  exam: { examKey: "snbt", groupAxis: "year", title: "SNBT" },
  group: { groupKey: "2027", publicPath: GROUP, title: "2027" },
  groups,
  tracks: [],
};
const trackPage = {
  country: { countryKey: "id" },
  exam: { examKey: "snbt", groupAxis: "year", title: "SNBT" },
  group: { groupKey: "2027", publicPath: GROUP, title: "2027" },
  groups,
  publicPath: TRACK,
  track: { title: "UTBK", trackKey: "2027" },
};
const hub = {
  countries: [{ publicPath: COUNTRY, title: "Indonesia" }],
  sourceRevision: undefined,
};
/** The country's address in each locale, as the catalog resolves its node: its slug differs in German. */
const ALTERNATES = [
  { appLocale: "en", publicPath: COUNTRY },
  { appLocale: "id", publicPath: COUNTRY },
  { appLocale: "de", publicPath: "try-out/indonesien" },
];
const publishedRoute = {
  alternates: ALTERNATES,
  canonicalPath: COUNTRY,
  description: "Country",
  publicPath: COUNTRY,
  socialImageIdentity: null,
  title: "Indonesia",
};

function publishRoute(route: object | undefined) {
  catalog.readTryoutMetadata.mockReturnValue(Effect.succeed({ route }));
}

beforeEach(() => {
  vi.clearAllMocks();
  catalog.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string, values?: { readonly name?: string }) =>
      values?.name === undefined ? key : `${key} ${values.name}`
    )
  );
  catalog.readTryoutSetList.mockReturnValue(
    Effect.succeed({ isDone: true, page: [] })
  );
  catalog.getOgUrl.mockReturnValue("og-url");
  catalog.getAppSocialArtwork.mockReturnValue("og-app");
  catalog.buildTryoutCountryOptions.mockReturnValue([]);
  catalog.buildTryoutExamOptions.mockReturnValue([]);
  catalog.buildTryoutGroupOptions.mockReturnValue([]);
  catalog.readTryoutHubPage.mockReturnValue(Effect.succeed(hub));
  catalog.readTryoutCountryPage.mockReturnValue(
    Effect.succeedSome(countryPage)
  );
  catalog.readTryoutGroupPage.mockReturnValue(Effect.succeed(groupPage));
  catalog.readTryoutTrackPage.mockReturnValue(Effect.succeed(trackPage));
  catalog.resolveTryoutExamArtwork.mockImplementation(({ examKey }) =>
    Effect.succeed({
      cardImageSrc: examKey === "snbt" ? "card-snbt.png" : undefined,
      socialImageSrc: "social-snbt.png",
    })
  );
  publishRoute(publishedRoute);
});

describe("readTryoutHubRoute", () => {
  it.effect("answers the hub with its catalog and its social artwork", () =>
    Effect.gen(function* () {
      const route = yield* readTryoutHubRoute("en");

      expect(route.page).toEqual(hub);
      expect(route.image).toBe("og-app");
    })
  );
  it("answers the hub through its server handler", async () => {
    const route = await readTryoutHubHandler({ data: { locale: "en" } });

    expect(route.page).toEqual(hub);
  });
});

describe("readTryoutCountryRoute", () => {
  it.effect("answers not found when the catalog has no country page", () =>
    Effect.gen(function* () {
      catalog.readTryoutCountryPage.mockReturnValue(Effect.succeedNone);

      const route = yield* readTryoutCountryRoute({
        country: "id",
        locale: "en",
      });

      expect(route).toEqual({ kind: "notFound" });
    })
  );

  it.effect("answers not found when the country has no head", () =>
    Effect.gen(function* () {
      publishRoute(undefined);

      const route = yield* readTryoutCountryRoute({
        country: "id",
        locale: "en",
      });

      expect(route).toEqual({ kind: "notFound" });
    })
  );

  it.effect(
    "shows each exam with its card artwork where the catalog names one",
    () =>
      Effect.gen(function* () {
        const route = yield* readTryoutCountryRoute({
          country: "id",
          locale: "en",
        });

        expect(route).toMatchObject({
          kind: "found",
          exams: [
            { examKey: "snbt", imageSrc: "card-snbt.png" },
            { examKey: "utbk" },
          ],
        });
      })
  );
});

/** Reads the group route of the fixture address. */
const readGroup = () =>
  readTryoutGroupRoute({
    country: "id",
    exam: "snbt",
    group: "2027",
    locale: "en",
  });

describe("readTryoutGroupRoute", () => {
  it.effect(
    "answers not found when the group, its country or its head is missing",
    () =>
      Effect.gen(function* () {
        catalog.readTryoutGroupPage.mockReturnValueOnce(Effect.void);
        expect(yield* readGroup()).toEqual({ kind: "notFound" });

        catalog.readTryoutCountryPage.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readGroup()).toEqual({ kind: "notFound" });

        publishRoute(undefined);
        expect(yield* readGroup()).toEqual({ kind: "notFound" });
      })
  );

  it.effect(
    "names the group by its exam and builds both selectors from the country's exams and the exam's groups",
    () =>
      Effect.gen(function* () {
        const route = yield* readGroup();

        expect(route).toMatchObject({
          countryPath: "try-out/id",
          head: { title: "search-title SNBT 2027" },
          kind: "found",
          name: "SNBT 2027",
          page: groupPage,
        });
        expect(catalog.buildTryoutExamOptions).toHaveBeenCalledExactlyOnceWith(
          countryPage.exams
        );
        expect(catalog.buildTryoutGroupOptions).toHaveBeenCalledExactlyOnceWith(
          groups
        );
      })
  );
});

/** The default catalog query of a track page. */
const TRACK_SEARCH = {
  direction: "asc",
  sort: "order",
  status: "all",
} satisfies CatalogQuery;

/** Reads the track route of the fixture address with the default query. */
const readTrack = () =>
  readTryoutTrackRoute({
    country: "id",
    exam: "snbt",
    group: "2027",
    locale: "en",
    search: TRACK_SEARCH,
    track: "utbk",
  });

describe("readTryoutTrackRoute", () => {
  it.effect("keeps the description a track was published with", () =>
    Effect.gen(function* () {
      const track = { ...trackPage.track, description: "Written for it." };
      catalog.readTryoutTrackPage.mockReturnValueOnce(
        Effect.succeed({ ...trackPage, track })
      );

      expect(yield* readTrack()).toMatchObject({
        head: { description: "Written for it." },
      });
    })
  );

  it.effect(
    "shares a track's reviewed artwork as its social image, and the generated image otherwise",
    () =>
      Effect.gen(function* () {
        expect(yield* readTrack()).toMatchObject({
          head: { image: "og-url" },
        });

        catalog.readTryoutTrackPage.mockReturnValueOnce(
          Effect.succeed({
            ...trackPage,
            country: { countryKey: "indonesia" },
            exam: { examKey: "tka", groupAxis: "grade", title: "TKA" },
            track: {
              title: "Compulsory Mathematics",
              trackKey: "compulsory-mathematics",
            },
          })
        );
        expect(yield* readTrack()).toMatchObject({
          head: {
            image:
              "/open-graph/tryout/indonesia/tka/en-compulsory-mathematics.png",
          },
        });
      })
  );

  it.effect(
    "answers not found when the track, its country or its head is missing",
    () =>
      Effect.gen(function* () {
        catalog.readTryoutTrackPage.mockReturnValueOnce(Effect.void);
        expect(yield* readTrack()).toEqual({ kind: "notFound" });

        catalog.readTryoutCountryPage.mockReturnValueOnce(Effect.succeedNone);
        expect(yield* readTrack()).toEqual({ kind: "notFound" });

        publishRoute(undefined);
        expect(yield* readTrack()).toEqual({ kind: "notFound" });
      })
  );

  it.effect(
    "builds the track page with its exam and group, its selectors and its set list",
    () =>
      Effect.gen(function* () {
        const route = yield* readTrack();

        expect(route).toMatchObject({
          countryPath: "try-out/id",
          head: {
            description: "track-metadata-description",
            title: "search-title SNBT 2027 UTBK",
          },
          kind: "found",
          list: { result: { isDone: true, page: [] } },
          page: trackPage,
        });
        expect(catalog.readTryoutSetList).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            countryKey: "id",
            examKey: "snbt",
            trackKey: "2027",
          })
        );
      })
  );
});

describe("readTryoutTrackSetList", () => {
  const search = {
    direction: "asc",
    sort: "title",
    status: "all",
  } satisfies CatalogQuery;
  const track = { countryKey: "id", examKey: "snbt", trackKey: "2027" };

  it.effect("reads one window of the list with the query of the address", () =>
    Effect.gen(function* () {
      catalog.readTryoutSetList.mockReturnValue(
        Effect.succeed({ page: [], isDone: true })
      );

      const list = yield* readTryoutTrackSetList({
        locale: "en",
        search,
        track,
      });

      expect(catalog.readTryoutSetList).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          countryKey: "id",
          examKey: "snbt",
          locale: "en",
          paginationOpts: { cursor: null, numItems: 25 },
          trackKey: "2027",
        })
      );
      expect(list.result).toEqual({ page: [], isDone: true });
    })
  );
});
