// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { readTryoutRouteHead } from "@/components/tryout/route/metadata.server";

const catalog = vi.hoisted(() => ({
  getOgUrl: vi.fn(),
  readServerTranslator: vi.fn(),
  readTryoutMetadata: vi.fn(),
  resolveTryoutExamArtwork: vi.fn(),
}));

vi.mock("@/components/tryout/catalog/source.server", () => ({
  readTryoutMetadata: catalog.readTryoutMetadata,
}));
vi.mock("@/lib/seo/social", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/seo/social")>()),
  getOgUrl: catalog.getOgUrl,
}));
vi.mock("@/lib/tryout/artwork", () => ({
  resolveTryoutExamArtwork: catalog.resolveTryoutExamArtwork,
}));
vi.mock("@repo/internationalization/src/translator", () => ({
  readServerTranslator: catalog.readServerTranslator,
}));

const COUNTRY = "try-out/id";
const EXAM = "try-out/id/snbt";
const GROUP = "try-out/id/snbt/2027";
const TRACK = "try-out/id/snbt/2027/utbk";
const TRACK_SET = "try-out/id/snbt/2027/utbk/set-1";

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
  page: true,
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
  catalog.getOgUrl.mockReturnValue("og-url");
  catalog.resolveTryoutExamArtwork.mockImplementation(({ examKey }) =>
    Effect.succeed({
      cardImageSrc: examKey === "snbt" ? "card-snbt.png" : undefined,
      socialImageSrc: "social-snbt.png",
    })
  );
  publishRoute(publishedRoute);
});

/** One ancestor a test publishes: its title, and whether a link lands on it. */
const Ancestor = Schema.Struct({ page: Schema.Boolean, title: Schema.String });

/** What a metadata read asks the catalog for. */
const MetadataRequest = Schema.Struct({ publicPath: Schema.String });

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
        alternates: [
          { href: `https://nakafa.com/en/${COUNTRY}`, hreflang: "en" },
          { href: `https://nakafa.com/id/${COUNTRY}`, hreflang: "id" },
          { href: "https://nakafa.com/de/try-out/indonesien", hreflang: "de" },
          { href: `https://nakafa.com/en/${COUNTRY}`, hreflang: "x-default" },
        ],
        breadcrumbs: [
          {
            "@type": "ListItem",
            item: "https://nakafa.com/en",
            name: "home",
            position: 1,
          },
          {
            "@type": "ListItem",
            item: `https://nakafa.com/en/${COUNTRY}`,
            name: "Indonesia",
            position: 2,
          },
        ],
        canonicalPath: `/en/${COUNTRY}`,
        description: "Country",
        image: "og-url",
        indexable: true,
        title: "search-title Indonesia",
      });
      expect(catalog.getOgUrl).toHaveBeenCalledExactlyOnceWith("en", COUNTRY);
    })
  );

  /** Publishes the given ancestors, each with its title and whether a link lands on it. */
  function publishAncestors(
    routes: Readonly<Record<string, typeof Ancestor.Type>>
  ) {
    catalog.readTryoutMetadata.mockImplementation(
      ({ publicPath }: typeof MetadataRequest.Type) => {
        const route = routes[publicPath];
        return Effect.succeed({
          route:
            route === undefined
              ? undefined
              : { ...publishedRoute, ...route, publicPath },
        });
      }
    );
  }

  it.effect(
    "names only pages in the breadcrumb: the exam and a group of one track lead the next crumb, and no hub",
    () =>
      Effect.gen(function* () {
        publishAncestors({
          [COUNTRY]: { page: true, title: "Indonesia" },
          [EXAM]: { page: false, title: "SNBT" },
          [GROUP]: { page: false, title: "2027" },
          [TRACK]: { page: true, title: "UTBK" },
          [TRACK_SET]: { page: true, title: "Set 1" },
        });

        const set = yield* readTryoutRouteHead({
          kind: "set",
          locale: "en",
          publicPath: TRACK_SET,
        });
        const group = yield* readTryoutRouteHead({
          kind: "group",
          locale: "en",
          publicPath: GROUP,
        });

        expect(
          Arr.map(Option.getOrThrow(set).breadcrumbs, ({ item, name }) => [
            name,
            item,
          ])
        ).toStrictEqual([
          ["home", "https://nakafa.com/en"],
          ["Indonesia", `https://nakafa.com/en/${COUNTRY}`],
          ["SNBT 2027 UTBK", `https://nakafa.com/en/${TRACK}`],
          ["Set 1", `https://nakafa.com/en/${TRACK_SET}`],
        ]);
        expect(
          Arr.map(Option.getOrThrow(group).breadcrumbs, ({ name }) => name)
        ).toStrictEqual(["home", "Indonesia", "SNBT 2027"]);
      })
  );

  it.effect(
    "keeps a group that is its own page as a crumb, its exam leading it, and skips an ancestor the catalog does not publish",
    () =>
      Effect.gen(function* () {
        publishAncestors({
          [COUNTRY]: { page: true, title: "Indonesia" },
          [EXAM]: { page: false, title: "TKA" },
          [GROUP]: { page: true, title: "Senior High School" },
          [TRACK_SET]: { page: true, title: "Set 1" },
        });

        const set = yield* readTryoutRouteHead({
          kind: "set",
          locale: "en",
          publicPath: TRACK_SET,
        });

        expect(
          Arr.map(Option.getOrThrow(set).breadcrumbs, ({ name }) => name)
        ).toStrictEqual([
          "home",
          "Indonesia",
          "TKA Senior High School",
          "Set 1",
        ]);
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
          "route-metadata-description Indonesia"
        );
      })
  );

  it.effect(
    "gives a group the artwork of its exam's social image identity",
    () =>
      Effect.gen(function* () {
        publishRoute({
          ...publishedRoute,
          description: undefined,
          socialImageIdentity: { examKey: "snbt", imageKey: "exam-a" },
        });

        const head = yield* readTryoutRouteHead({
          kind: "group",
          locale: "en",
          publicPath: GROUP,
        });

        expect(Option.getOrThrow(head).image).toBe("social-snbt.png");
        expect(Option.getOrThrow(head).description).toBe(
          "route-metadata-description Indonesia"
        );
        expect(
          catalog.resolveTryoutExamArtwork
        ).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({ examKey: "snbt", publicPath: COUNTRY })
        );
      })
  );
});
