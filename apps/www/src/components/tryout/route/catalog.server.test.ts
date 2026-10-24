// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import {
  readTryoutCountryRoute,
  readTryoutExamRoute,
  readTryoutHubHandler,
  readTryoutHubRoute,
  readTryoutRouteHead,
  readTryoutTrackRoute,
  readTryoutTrackSetList,
} from "@/components/tryout/route/catalog.server";

const catalog = vi.hoisted(() => ({
  buildTryoutCountryOptions: vi.fn(),
  buildTryoutExamOptions: vi.fn(),
  getAksaraTreeUrl: vi.fn(),
  getAppSocialArtwork: vi.fn(),
  getOgUrl: vi.fn(),
  readCatalogQuery: vi.fn(),
  readRequestToken: vi.fn(),
  readServerTranslator: vi.fn(),
  readTryoutCountryPage: vi.fn(),
  readTryoutExamPage: vi.fn(),
  readTryoutHubPage: vi.fn(),
  readTryoutMetadata: vi.fn(),
  readTryoutSetList: vi.fn(),
  readTryoutTrackPage: vi.fn(),
  resolveTryoutExamArtwork: vi.fn(),
  setResponseHeader: vi.fn(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/try-out"),
  setResponseHeader: catalog.setResponseHeader,
}));
vi.mock("@/components/tryout/catalog/options", () => ({
  buildTryoutCountryOptions: catalog.buildTryoutCountryOptions,
  buildTryoutExamOptions: catalog.buildTryoutExamOptions,
}));
vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutCountryPage: catalog.readTryoutCountryPage,
  readTryoutExamPage: catalog.readTryoutExamPage,
  readTryoutHubPage: catalog.readTryoutHubPage,
  readTryoutMetadata: catalog.readTryoutMetadata,
  readTryoutSetList: catalog.readTryoutSetList,
  readTryoutTrackPage: catalog.readTryoutTrackPage,
}));
vi.mock("@/components/tryout/catalog/table/query", () => ({
  readCatalogQuery: catalog.readCatalogQuery,
}));
vi.mock("@/components/tryout/route/token.server", () => ({
  readRequestToken: catalog.readRequestToken,
}));
vi.mock("@/lib/content/repository", () => ({
  getAksaraTreeUrl: catalog.getAksaraTreeUrl,
}));
vi.mock("@/lib/og/app", () => ({
  getAppSocialArtwork: catalog.getAppSocialArtwork,
}));
vi.mock("@/lib/seo/social", () => ({ getOgUrl: catalog.getOgUrl }));
vi.mock("@/lib/tryout/artwork", () => ({
  resolveTryoutExamArtwork: catalog.resolveTryoutExamArtwork,
}));
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: catalog.readServerTranslator,
}));

const COUNTRY = "try-out/id";
const EXAM = "try-out/id/snbt";
const TRACK = "try-out/id/snbt/2027";
const SOURCE = "a".repeat(40);

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
  sourceRevision: SOURCE,
};
const examPage = { exam: { examKey: "snbt" }, publicPath: EXAM };
const trackPage = { publicPath: TRACK, track: { title: "2027" } };
const hub = {
  countries: [{ publicPath: COUNTRY, title: "Indonesia" }],
  sourceRevision: undefined,
};
const publishedRoute = {
  canonicalPath: COUNTRY,
  description: "Country",
  publicPath: COUNTRY,
  socialImageIdentity: undefined,
  title: "Indonesia",
};

function publishRoute(route: object | undefined) {
  catalog.readTryoutMetadata.mockReturnValue(Effect.succeed({ route }));
}

beforeEach(() => {
  vi.clearAllMocks();
  catalog.readServerTranslator.mockImplementation(() =>
    Promise.resolve((key: string) => key)
  );
  catalog.getOgUrl.mockReturnValue("og-url");
  catalog.getAppSocialArtwork.mockReturnValue("og-app");
  catalog.getAksaraTreeUrl.mockImplementation(
    ({ path, revision }: { path: string; revision: string }) =>
      `https://aksara.test/${path}/${revision}`
  );
  catalog.buildTryoutCountryOptions.mockReturnValue([]);
  catalog.buildTryoutExamOptions.mockReturnValue([]);
  catalog.readTryoutHubPage.mockReturnValue(Effect.succeed(hub));
  catalog.readTryoutCountryPage.mockReturnValue(
    Effect.succeedSome(countryPage)
  );
  catalog.readTryoutExamPage.mockReturnValue(Effect.succeed(examPage));
  catalog.readTryoutTrackPage.mockReturnValue(Effect.succeed(trackPage));
  catalog.resolveTryoutExamArtwork.mockImplementation(({ examKey }) =>
    Effect.succeed({
      cardImageSrc: examKey === "snbt" ? "card-snbt.png" : undefined,
      socialImageSrc: "social-snbt.png",
    })
  );
  publishRoute(publishedRoute);
});

describe("readTryoutRouteHead", () => {
  it.effect("reads no head for a route the catalog does not publish", () =>
    Effect.gen(function* () {
      publishRoute(undefined);

      const head = yield* readTryoutRouteHead({
        kind: "country",
        locale: "en",
        publicPath: COUNTRY,
      });

      expect(Option.isNone(head)).toBe(true);
    })
  );

  it.effect("builds the head of a country with its own description", () =>
    Effect.gen(function* () {
      const head = yield* readTryoutRouteHead({
        kind: "country",
        locale: "en",
        publicPath: COUNTRY,
      });

      expect(Option.getOrThrow(head)).toEqual({
        canonicalPath: `/en/${COUNTRY}`,
        description: "Country",
        image: "og-url",
        indexable: true,
        title: "Indonesia",
      });
      expect(catalog.getOgUrl).toHaveBeenCalledExactlyOnceWith("en", COUNTRY);
    })
  );

  it.effect(
    "falls back to the catalog description when the route has none",
    () =>
      Effect.gen(function* () {
        publishRoute({ ...publishedRoute, description: undefined });

        const head = yield* readTryoutRouteHead({
          kind: "track",
          locale: "en",
          publicPath: TRACK,
        });

        expect(Option.getOrThrow(head).description).toBe(
          "metadata-description"
        );
      })
  );

  it.effect(
    "reads no head for an exam without the social image identity it needs",
    () =>
      Effect.gen(function* () {
        const head = yield* readTryoutRouteHead({
          kind: "exam",
          locale: "en",
          publicPath: EXAM,
        });

        expect(Option.isNone(head)).toBe(true);
        expect(catalog.resolveTryoutExamArtwork).not.toHaveBeenCalled();
      })
  );

  it.effect("uses the artwork of the exam's social image identity", () =>
    Effect.gen(function* () {
      publishRoute({
        ...publishedRoute,
        description: undefined,
        socialImageIdentity: { examKey: "snbt", imageKey: "exam-a" },
      });

      const head = yield* readTryoutRouteHead({
        kind: "exam",
        locale: "en",
        publicPath: EXAM,
      });

      expect(Option.getOrThrow(head).image).toBe("social-snbt.png");
      expect(Option.getOrThrow(head).description).toBe("metadata-description");
      expect(catalog.resolveTryoutExamArtwork).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ examKey: "snbt", publicPath: COUNTRY })
      );
    })
  );
});

describe("readTryoutHubRoute", () => {
  it.effect(
    "links the hub to its Aksara source tree at the catalog revision",
    () =>
      Effect.gen(function* () {
        const route = yield* readTryoutHubRoute("en");

        expect(route.sourceUrl).toBeUndefined();
        catalog.readTryoutHubPage.mockReturnValueOnce(
          Effect.succeed({ ...hub, sourceRevision: SOURCE })
        );
        const linked = yield* readTryoutHubRoute("en");

        expect(linked.sourceUrl).toBe(
          `https://aksara.test/packages/corpus/tryout/${SOURCE}`
        );
        expect(linked.image).toBe("og-app");
      })
  );
  it("answers the hub through its server handler", async () => {
    const route = await readTryoutHubHandler({ data: { locale: "en" } });

    expect(route.sourceUrl).toBeUndefined();
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
          sourceUrl: `https://aksara.test/packages/corpus/tryout/id/${SOURCE}`,
        });
      })
  );

  it.effect(
    "leaves the source link out when the catalog names no revision",
    () =>
      Effect.gen(function* () {
        catalog.readTryoutCountryPage.mockReturnValue(
          Effect.succeedSome({ ...countryPage, sourceRevision: undefined })
        );

        const route = yield* readTryoutCountryRoute({
          country: "id",
          locale: "en",
        });

        expect(route).toMatchObject({ kind: "found", sourceUrl: undefined });
      })
  );
});

describe("readTryoutExamRoute", () => {
  it.effect("answers not found when the exam or its country is missing", () =>
    Effect.gen(function* () {
      catalog.readTryoutExamPage.mockReturnValueOnce(Effect.void);
      expect(
        yield* readTryoutExamRoute({
          country: "id",
          exam: "snbt",
          locale: "en",
        })
      ).toEqual({ kind: "notFound" });

      catalog.readTryoutCountryPage.mockReturnValueOnce(Effect.succeedNone);
      expect(
        yield* readTryoutExamRoute({
          country: "id",
          exam: "snbt",
          locale: "en",
        })
      ).toEqual({ kind: "notFound" });
    })
  );

  it.effect("answers not found when the exam has no head", () =>
    Effect.gen(function* () {
      publishRoute(undefined);

      expect(
        yield* readTryoutExamRoute({
          country: "id",
          exam: "snbt",
          locale: "en",
        })
      ).toEqual({ kind: "notFound" });
    })
  );

  it.effect("builds the exam selector from the exams of its country", () =>
    Effect.gen(function* () {
      publishRoute({
        ...publishedRoute,
        socialImageIdentity: { examKey: "snbt", imageKey: "exam-a" },
      });
      const route = yield* readTryoutExamRoute({
        country: "id",
        exam: "snbt",
        locale: "en",
      });

      expect(route).toMatchObject({
        countryPath: "try-out/id",
        examPath: EXAM,
        kind: "found",
      });
      expect(catalog.buildTryoutExamOptions).toHaveBeenCalledExactlyOnceWith(
        countryPage.exams
      );
    })
  );
});

describe("readTryoutTrackRoute", () => {
  it.effect(
    "answers not found when the track, its country or its head is missing",
    () =>
      Effect.gen(function* () {
        catalog.readTryoutTrackPage.mockReturnValueOnce(Effect.void);
        expect(
          yield* readTryoutTrackRoute({
            country: "id",
            exam: "snbt",
            locale: "en",
            track: "2027",
          })
        ).toEqual({ kind: "notFound" });

        catalog.readTryoutCountryPage.mockReturnValueOnce(Effect.succeedNone);
        expect(
          yield* readTryoutTrackRoute({
            country: "id",
            exam: "snbt",
            locale: "en",
            track: "2027",
          })
        ).toEqual({ kind: "notFound" });

        publishRoute(undefined);
        expect(
          yield* readTryoutTrackRoute({
            country: "id",
            exam: "snbt",
            locale: "en",
            track: "2027",
          })
        ).toEqual({ kind: "notFound" });
      })
  );

  it.effect("builds the track page with its exam and its selector", () =>
    Effect.gen(function* () {
      const route = yield* readTryoutTrackRoute({
        country: "id",
        exam: "snbt",
        locale: "en",
        track: "2027",
      });

      expect(route).toMatchObject({
        examPath: EXAM,
        kind: "found",
        page: trackPage,
      });
    })
  );
});

describe("readTryoutTrackSetList", () => {
  const search = { direction: "asc", sort: "title", status: "all" };
  const track = { countryKey: "id", examKey: "snbt", trackKey: "2027" };

  it.effect(
    "reads the learner's set list with their token and marks the answer private",
    () =>
      Effect.gen(function* () {
        catalog.readRequestToken.mockReturnValue(Effect.succeedSome("token-1"));
        catalog.readCatalogQuery.mockReturnValue({
          direction: "asc",
          sort: "title",
          status: "all",
        });
        catalog.readTryoutSetList.mockReturnValue(
          Effect.succeed({ page: [], isDone: true })
        );

        const list = yield* readTryoutTrackSetList({
          locale: "en",
          search,
          track,
        });

        expect(catalog.setResponseHeader).toHaveBeenCalledExactlyOnceWith(
          "cache-control",
          "private, no-store"
        );
        expect(catalog.readCatalogQuery).toHaveBeenCalledExactlyOnceWith(
          search
        );
        expect(catalog.readTryoutSetList).toHaveBeenCalledExactlyOnceWith(
          Option.some("token-1"),
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

  it.effect(
    "reads the list without a token for a visitor without a session",
    () =>
      Effect.gen(function* () {
        catalog.readRequestToken.mockReturnValue(Effect.succeedNone);
        catalog.readCatalogQuery.mockReturnValue({
          direction: undefined,
          sort: undefined,
          status: undefined,
        });
        catalog.readTryoutSetList.mockReturnValue(Effect.succeed({ page: [] }));

        yield* readTryoutTrackSetList({ locale: "en", search: {}, track });

        expect(catalog.readTryoutSetList).toHaveBeenCalledExactlyOnceWith(
          Option.none(),
          expect.any(Object)
        );
      })
  );
});
