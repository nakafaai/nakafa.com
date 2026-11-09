// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";
import { type RouteIdentity, serveTryoutCatalog } from "@/test/catalog";

const mocks = vi.hoisted(() => ({
  exam: vi.fn(),
  group: vi.fn(),
  path: vi.fn(),
  section: vi.fn(),
}));
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: mocks.path,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: mocks.exam,
  readPublishedTryoutGroupPage: mocks.group,
  readPublishedTryoutSectionPage: mocks.section,
}));

/** Serves exactly the signed routes of one catalog. */
function serveCatalog(routes: readonly RouteIdentity[]) {
  serveTryoutCatalog(mocks, { routes });
}

describe("retired try-out redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("retired SNBT section URLs", () => {
    it.effect.each([
      [
        "/id/try-out/indonesia/snbt/2027/utbk/set-3/bahasa-inggris",
        "id",
        "/id/try-out/indonesia/snbt/2027/utbk/set-3/literasi-dalam-bahasa-inggris",
      ],
      [
        "/en/try-out/indonesia/snbt/2027/utbk/set-1/reading-and-writing-skills",
        "en",
        "/en/try-out/indonesia/snbt/2027/utbk/set-1/reading-comprehension-and-writing",
      ],
      [
        "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-2/allgemeinwissen",
        "de",
        "/de/try-out/indonesien/snbt/2027/utbk/aufgabensatz-2/allgemeines-wissen-und-verstaendnis",
      ],
    ] as const)(
      "redirects %s once its successor is live",
      ([pathname, appLocale, successor]) =>
        Effect.gen(function* () {
          serveCatalog([{ [appLocale]: successor.slice(4) }]);

          expect(yield* readTryoutRedirect(pathname)).toEqual({
            destination: successor,
            status: 308,
          });
          expect(mocks.path).toHaveBeenCalledWith({
            currentAppLocale: appLocale,
            publicPath: successor.slice(4),
            targetAppLocale: appLocale,
          });
        })
    );

    it.effect(
      "keeps a retired route that the active catalog still serves",
      () =>
        Effect.gen(function* () {
          serveCatalog([
            { id: "try-out/indonesia/snbt/2027/utbk/set-1/pengetahuan-umum" },
            {
              id: "try-out/indonesia/snbt/2027/utbk/set-1/pengetahuan-dan-pemahaman-umum",
            },
          ]);

          expect(
            yield* readTryoutRedirect(
              "/id/try-out/indonesia/snbt/2027/utbk/set-1/pengetahuan-umum"
            )
          ).toBeNull();
        })
    );

    it.effect("keeps a section that never took a new name where it is", () =>
      Effect.gen(function* () {
        serveCatalog([]);

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/indonesia/snbt/2027/utbk/set-1/quantitative-knowledge"
          )
        ).toBeNull();
      })
    );

    it.effect("waits until the active catalog serves the successor", () =>
      Effect.gen(function* () {
        serveCatalog([]);

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/indonesia/snbt/2027/utbk/set-1/english-language"
          )
        ).toBeNull();
      })
    );
  });
});
