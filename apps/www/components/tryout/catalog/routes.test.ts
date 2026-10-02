import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readTryoutCatalogRoutes } from "@/components/tryout/catalog/routes";

const catalogMocks = vi.hoisted(() => ({
  readTryoutCountryPage: vi.fn(),
  readTryoutExamPage: vi.fn(),
  readTryoutHubPage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/components/tryout/catalog/server", () => catalogMocks);

const country = "try-out/indonesia";
const snbt = `${country}/snbt`;
const tka = `${country}/tka`;

beforeEach(() => {
  catalogMocks.readTryoutCountryPage.mockReset();
  catalogMocks.readTryoutExamPage.mockReset();
  catalogMocks.readTryoutHubPage.mockReset();
  catalogMocks.readTryoutHubPage.mockResolvedValue({
    countries: [{ publicPath: country }],
  });
  catalogMocks.readTryoutCountryPage.mockResolvedValue({
    country: { publicPath: country },
    exams: [{ publicPath: snbt }, { publicPath: tka }],
  });
});

describe("try-out catalog routes", () => {
  it.effect("lists every published country, exam, and track", () =>
    Effect.gen(function* () {
      catalogMocks.readTryoutExamPage.mockImplementation(
        (_locale: string, publicPath: string) =>
          Promise.resolve({
            tracks:
              publicPath === snbt
                ? [{ publicPath: `${snbt}/2027` }]
                : [
                    { publicPath: `${tka}/matematika` },
                    { publicPath: `${tka}/fisika` },
                  ],
          })
      );

      expect(yield* readTryoutCatalogRoutes("en")).toEqual({
        countries: [{ country: "indonesia" }],
        exams: [
          { country: "indonesia", exam: "snbt" },
          { country: "indonesia", exam: "tka" },
        ],
        tracks: [
          { country: "indonesia", exam: "snbt", track: "2027" },
          { country: "indonesia", exam: "tka", track: "matematika" },
          { country: "indonesia", exam: "tka", track: "fisika" },
        ],
      });
      expect(catalogMocks.readTryoutHubPage).toHaveBeenCalledWith("en");
      expect(catalogMocks.readTryoutCountryPage).toHaveBeenCalledWith(
        "en",
        country
      );
    })
  );

  it.effect("fails when the catalog lacks a page its parent lists", () =>
    Effect.gen(function* () {
      catalogMocks.readTryoutExamPage.mockResolvedValue(null);

      const error = yield* Effect.flip(readTryoutCatalogRoutes("id"));

      expect(error).toMatchObject({
        _tag: "TryoutCatalogRouteError",
        publicPath: snbt,
      });
    })
  );

  it.effect("fails when a catalog page cannot be read", () =>
    Effect.gen(function* () {
      const cause = new Error("Convex is unreachable");
      catalogMocks.readTryoutHubPage.mockRejectedValue(cause);

      const error = yield* Effect.flip(readTryoutCatalogRoutes("de"));

      expect(error).toMatchObject({
        _tag: "TryoutCatalogRouteError",
        cause,
        publicPath: "try-out",
      });
    })
  );
});
