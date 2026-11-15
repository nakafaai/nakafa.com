// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readHubRedirect } from "@/lib/routing/public/tryout/hub";

const hub = vi.hoisted(() => vi.fn());
vi.mock("@/lib/content/tryout/catalog", () => ({
  readPublishedTryoutHubPage: hub,
}));

const COUNTRIES = [
  { countryCode: "ID", publicPath: "try-out/indonesia" },
  { countryCode: "DE", publicPath: "try-out/deutschland" },
];

describe("the address of Try out", () => {
  it.effect("opens the locale's own country, else the catalog's first", () =>
    Effect.gen(function* () {
      hub.mockReturnValue(Effect.succeed({ countries: COUNTRIES }));
      expect(yield* readHubRedirect("/de/try-out")).toEqual({
        destination: "/de/try-out/deutschland",
        status: 307,
      });
      expect(yield* readHubRedirect("/en/try-out")).toEqual({
        destination: "/en/try-out/indonesia",
        status: 307,
      });
    })
  );

  it.effect(
    "leaves every other path, and a catalog without a country, alone",
    () =>
      Effect.gen(function* () {
        hub.mockReturnValue(Effect.succeed({ countries: [] }));
        expect(yield* readHubRedirect("/en/try-out")).toBeNull();
        for (const pathname of [
          "/en",
          "/fr/try-out",
          "/en/articles",
          "/en/try-out/indonesia",
        ]) {
          expect(yield* readHubRedirect(pathname)).toBeNull();
        }
      })
  );
});
