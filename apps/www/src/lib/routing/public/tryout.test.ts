// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";
import { serveTryoutCatalog } from "@/test/catalog";

const mocks = vi.hoisted(() => ({
  country: vi.fn(),
  exam: vi.fn(),
  group: vi.fn(),
  path: vi.fn(),
  section: vi.fn(),
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: mocks.path,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutCountryPage: mocks.country,
  readPublishedTryoutExamPage: mocks.exam,
  readPublishedTryoutGroupPage: mocks.group,
  readPublishedTryoutSectionPage: mocks.section,
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
    countries: [
      {
        appLocale: "en",
        entryPath: "try-out/indonesia",
        publicPath: "try-out/indonesia",
      },
    ],
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
  it.effect.each([
    "/fr/try-out/indonesia/snbt/2027/utbk/set-1/bahasa-inggris",
    "/en/articles/politics/bahasa-inggris",
    "/id",
    "/en/try-out",
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

  it.effect("leaves a country with more than one exam on its own page", () =>
    Effect.gen(function* () {
      expect(yield* readTryoutRedirect("/en/try-out/indonesia")).toBeNull();
      expect(mocks.country).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "enters a country with one exam at its entry, and moves a renamed exam for good",
    () =>
      Effect.gen(function* () {
        serveTryoutCatalog(mocks, {
          countries: [
            {
              appLocale: "en",
              entryPath: "try-out/germany/aufnahmepruefung/kolleg/mathematics",
              publicPath: "try-out/germany",
            },
          ],
          routes: [{ en: "try-out/germany/aufnahmepruefung" }],
        });
        expect(yield* readTryoutRedirect("/en/try-out/germany")).toEqual({
          destination:
            "/en/try-out/germany/aufnahmepruefung/kolleg/mathematics",
          status: 307,
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
