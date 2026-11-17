// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";
import { serveTryoutCatalog } from "@/test/catalog";

const mocks = vi.hoisted(() => ({
  exam: vi.fn(),
  group: vi.fn(),
  path: vi.fn(),
  section: vi.fn(),
}));
vi.mock("@/lib/routing/public/tryout/map.server", () => ({
  readMappedLocalizedPath: mocks.path,
  readMappedHubPage: () =>
    Effect.succeed({
      countries: [
        { countryCode: "ID", publicPath: "try-out/indonesia" },
        { countryCode: "DE", publicPath: "try-out/germany" },
      ],
    }),
  readMappedExamPage: mocks.exam,
  readMappedGroupPage: mocks.group,
  readMappedSectionPage: mocks.section,
  /** Reads whether the catalog serves one path in its own locale, through the localized-path mock. */
  readActiveTryoutPath: (appLocale: string, publicPath: string) =>
    mocks.path({
      currentAppLocale: appLocale,
      publicPath,
      targetAppLocale: appLocale,
    }),
}));

/** The pages of SNBT that the signed catalog serves in English and German. */
const LIVE = [
  "try-out/indonesia/snbt/2027",
  "try-out/indonesia/snbt/2027/utbk",
  "try-out/indonesia/snbt/2027/utbk/set-1",
  "try-out/indonesien/snbt/2027",
  "try-out/indonesien/snbt/2027/utbk/aufgabensatz-1",
];

beforeEach(() => {
  vi.clearAllMocks();
  serveTryoutCatalog(mocks, {
    routes: [
      { en: LIVE[0] },
      { en: LIVE[1] },
      { en: LIVE[2] },
      { de: LIVE[3] },
      { de: LIVE[4] },
    ],
  });
});

describe("retired try-out redirects", () => {
  it.effect(
    "opens a locale's own country for the address of Try out, and moves a renamed exam for good",
    () =>
      Effect.gen(function* () {
        expect(yield* readTryoutRedirect("/de/try-out")).toEqual({
          destination: "/de/try-out/germany",
          status: 307,
        });
        serveTryoutCatalog(mocks, {
          routes: [{ en: "try-out/germany/aufnahmepruefung" }],
        });
        expect(
          yield* readTryoutRedirect("/en/try-out/germany/entrance-examination")
        ).toEqual({
          destination: "/en/try-out/germany/aufnahmepruefung",
          status: 308,
        });
      })
  );

  it.effect.each([
    "/fr/try-out/indonesia/snbt/2027/utbk/set-1/bahasa-inggris",
    "/en/articles/politics/bahasa-inggris",
    "/id",
    "/en/try-out/indonesia",
    "/fr/try-out/snbt",
  ])(
    "leaves %s, which names no exam, alone without reading the catalog",
    (pathname) =>
      Effect.gen(function* () {
        expect(yield* readTryoutRedirect(pathname)).toBeNull();
        expect(mocks.path).not.toHaveBeenCalled();
        expect(mocks.exam).not.toHaveBeenCalled();
        expect(mocks.section).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    "/en/try-out/indonesia/snbt/2027",
    "/en/try-out/indonesia/snbt/2027/utbk",
    "/en/try-out/indonesia/snbt/2027/utbk/set-1",
    "/de/try-out/indonesien/snbt/2027",
    "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-1",
  ])("leaves the live page %s alone", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readTryoutRedirect(pathname)).toBeNull();
    })
  );
});
