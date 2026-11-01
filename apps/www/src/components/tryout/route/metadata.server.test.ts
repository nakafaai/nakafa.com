// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
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
const TRACK = "try-out/id/snbt/2027";
const TRACK_SET = "try-out/id/snbt/2027/set-1";

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
  socialImageIdentity: undefined,
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
            item: "https://nakafa.com/en/try-out",
            name: "try-out",
            position: 2,
          },
          {
            "@type": "ListItem",
            item: `https://nakafa.com/en/${COUNTRY}`,
            name: "Indonesia",
            position: 3,
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

  it.effect(
    "walks the breadcrumb down each ancestor the catalog publishes, skipping one it does not",
    () =>
      Effect.gen(function* () {
        catalog.readTryoutMetadata.mockImplementation(
          ({ publicPath }: { readonly publicPath: string }) => {
            const titles: Readonly<Record<string, string>> = {
              [COUNTRY]: "Indonesia",
              [TRACK]: "Year 2027",
            };
            const title = titles[publicPath];
            return Effect.succeed({
              route:
                title === undefined && publicPath !== TRACK_SET
                  ? undefined
                  : {
                      ...publishedRoute,
                      publicPath,
                      title: title ?? "Set 1",
                    },
            });
          }
        );

        const head = yield* readTryoutRouteHead({
          kind: "set",
          locale: "en",
          publicPath: TRACK_SET,
        });

        expect(
          Arr.map(Option.getOrThrow(head).breadcrumbs, ({ item, name }) => [
            name,
            item,
          ])
        ).toStrictEqual([
          ["home", "https://nakafa.com/en"],
          ["try-out", "https://nakafa.com/en/try-out"],
          ["Indonesia", `https://nakafa.com/en/${COUNTRY}`],
          ["Year 2027", `https://nakafa.com/en/${TRACK}`],
          ["Set 1", `https://nakafa.com/en/${TRACK_SET}`],
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
