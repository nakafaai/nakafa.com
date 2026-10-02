// @vitest-environment node
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutSectionRedirect } from "@/lib/routing/public/tryout";

const readLocalizedPathMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/tryout/path", () => ({
  readPublishedTryoutLocalizedPath: readLocalizedPathMock,
}));

/** Serves exactly the given routes from the active signed catalog. */
function serveActiveRoutes(...paths: readonly string[]) {
  readLocalizedPathMock.mockImplementation(
    ({ publicPath }: { readonly publicPath: string }) =>
      Effect.succeed(paths.includes(publicPath) ? publicPath : null)
  );
}

describe("retired try-out section redirects", () => {
  beforeEach(() => {
    readLocalizedPathMock.mockReset();
  });

  it.effect.each([
    [
      "/id/try-out/indonesia/snbt/2027/set-3/bahasa-inggris",
      "/id/try-out/indonesia/snbt/2027/set-3/literasi-dalam-bahasa-inggris",
    ],
    [
      "/en/try-out/indonesia/snbt/2027/set-1/reading-and-writing-skills",
      "/en/try-out/indonesia/snbt/2027/set-1/reading-comprehension-and-writing",
    ],
    [
      "/de/try-out/indonesien/snbt/2027/aufgabensatz-2/allgemeinwissen",
      "/de/try-out/indonesien/snbt/2027/aufgabensatz-2/allgemeines-wissen-und-verstaendnis",
    ],
  ])("redirects %s once its successor is live", ([pathname, successor]) =>
    Effect.gen(function* () {
      serveActiveRoutes(successor.slice(4));

      expect(yield* readTryoutSectionRedirect(pathname)).toBe(successor);
      expect(readLocalizedPathMock).toHaveBeenCalledWith({
        currentAppLocale: successor.slice(1, 3),
        publicPath: successor.slice(4),
        targetAppLocale: successor.slice(1, 3),
      });
    })
  );

  it.effect("keeps a retired route that the active catalog still serves", () =>
    Effect.gen(function* () {
      serveActiveRoutes(
        "try-out/indonesia/snbt/2027/set-1/pengetahuan-umum",
        "try-out/indonesia/snbt/2027/set-1/pengetahuan-dan-pemahaman-umum"
      );

      expect(
        yield* readTryoutSectionRedirect(
          "/id/try-out/indonesia/snbt/2027/set-1/pengetahuan-umum"
        )
      ).toBeNull();
    })
  );

  it.effect("waits until the active catalog serves the successor", () =>
    Effect.gen(function* () {
      serveActiveRoutes();

      expect(
        yield* readTryoutSectionRedirect(
          "/en/try-out/indonesia/snbt/2027/set-1/english-language"
        )
      ).toBeNull();
    })
  );

  it.effect.each([
    "/id/try-out/indonesia/tka/bahasa-inggris/set-1",
    "/id/try-out/indonesia/snbt/2027/set-1/penalaran-umum",
    "/id/try-out/indonesia/snbt/2027/set-1/bahasa-inggris/extra",
    "/fr/try-out/indonesia/snbt/2027/set-1/bahasa-inggris",
    "/en/articles/politics/bahasa-inggris",
    "/id",
  ])("leaves %s alone without reading the catalog", (pathname) =>
    Effect.gen(function* () {
      expect(yield* readTryoutSectionRedirect(pathname)).toBeNull();
      expect(readLocalizedPathMock).not.toHaveBeenCalled();
    })
  );
});
