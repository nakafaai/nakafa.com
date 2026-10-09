// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { Array as Arr, Effect, Option } from "effect";
import { readTryoutRedirect } from "@/lib/routing/public/tryout";

/** One signed route identity, with the public path that each locale serves for it. */
type RouteIdentity = Partial<Record<AppLocaleCode, string>>;

const readLocalizedPathMock = vi.hoisted(() => vi.fn());
const readExamPageMock = vi.hoisted(() => vi.fn());
const readSectionPageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: readLocalizedPathMock,
}));
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutExamPage: readExamPageMock,
  readPublishedTryoutSectionPage: readSectionPageMock,
}));

/** Serves exactly the signed routes of one catalog. */
function serveCatalog({
  routes = [],
}: {
  readonly routes?: readonly RouteIdentity[];
}) {
  readLocalizedPathMock.mockImplementation(
    ({
      currentAppLocale,
      publicPath,
      targetAppLocale,
    }: {
      readonly currentAppLocale: AppLocaleCode;
      readonly publicPath: string;
      readonly targetAppLocale: AppLocaleCode;
    }) =>
      Effect.succeed(
        Option.getOrNull(
          Option.flatMap(
            Arr.findFirst(
              routes,
              (route) => route[currentAppLocale] === publicPath
            ),
            (route) => Option.fromNullishOr(route[targetAppLocale])
          )
        )
      )
  );
}

describe("retired try-out redirects", () => {
  beforeEach(() => {
    readLocalizedPathMock.mockReset();
    readExamPageMock.mockReset();
    readSectionPageMock.mockReset();
  });

  describe("retired SNBT section URLs", () => {
    it.effect.each([
      [
        "/id/try-out/indonesia/snbt/2027/set-3/bahasa-inggris",
        "id",
        "/id/try-out/indonesia/snbt/2027/set-3/literasi-dalam-bahasa-inggris",
      ],
      [
        "/en/try-out/indonesia/snbt/2027/set-1/reading-and-writing-skills",
        "en",
        "/en/try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing",
      ],
      [
        "/de/try-out/indonesien/snbt/2027/aufgabensatz-2/allgemeinwissen",
        "de",
        "/de/try-out/indonesien/snbt/2027/aufgabensatz-2/allgemeines-wissen-und-verstaendnis",
      ],
    ] as const)(
      "redirects %s once its successor is live",
      ([pathname, appLocale, successor]) =>
        Effect.gen(function* () {
          serveCatalog({
            routes: [{ [appLocale]: successor.slice(4) }],
          });

          expect(yield* readTryoutRedirect(pathname)).toBe(successor);
          expect(readLocalizedPathMock).toHaveBeenCalledWith({
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
          serveCatalog({
            routes: [
              {
                id: "try-out/indonesia/snbt/2027/set-1/pengetahuan-umum",
              },
              {
                id: "try-out/indonesia/snbt/2027/set-1/pengetahuan-dan-pemahaman-umum",
              },
            ],
          });

          expect(
            yield* readTryoutRedirect(
              "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-umum"
            )
          ).toBeNull();
        })
    );

    it.effect("waits until the active catalog serves the successor", () =>
      Effect.gen(function* () {
        serveCatalog({});

        expect(
          yield* readTryoutRedirect(
            "/en/try-out/indonesia/snbt/2027/set-1/english-language"
          )
        ).toBeNull();
      })
    );
  });
});
