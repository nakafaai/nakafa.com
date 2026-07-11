import { listPublicTryoutRoutes } from "@repo/contents/_types/route/tryout";
import { defineTryoutExamSource } from "@repo/contents/_types/tryout/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("public try-out routes", () => {
  it("projects default country-first try-out routes", () => {
    const routes = Effect.runSync(listPublicTryoutRoutes());
    const countryRoutes = routes.filter(
      (route) => route.kind === "tryout-country"
    );

    expect(countryRoutes).toHaveLength(2);
    expect(routes).toContainEqual(
      expect.objectContaining({
        countryKey: "indonesia",
        kind: "tryout-country",
        locale: "id",
        publicPath: "try-out/indonesia",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        countryKey: "indonesia",
        examKey: "snbt",
        kind: "tryout-track",
        locale: "id",
        publicPath: "try-out/indonesia/snbt/2027",
        trackKey: "2027",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        countryKey: "indonesia",
        examKey: "snbt",
        kind: "tryout-section",
        locale: "id",
        publicPath: "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
        sectionKey: "quantitative-knowledge",
        setKey: "set-1",
        trackKey: "2027",
      })
    );
    expect(routes).not.toContainEqual(
      expect.objectContaining({
        kind: "tryout-section",
        publicPath: "try-out/indonesia/tka/matematika/set-1/matematika",
      })
    );
  });

  it("uses caller-provided try-out sources without falling back to defaults", () => {
    const source = TRYOUT_SOURCES.find(
      (candidate) => candidate.examKey === "snbt"
    );

    expect(source).toBeDefined();
    if (!source) {
      return;
    }

    expect(Effect.runSync(listPublicTryoutRoutes({ tryouts: [] }))).toEqual([]);
    expect(
      Effect.runSync(listPublicTryoutRoutes({ tryouts: [source] })).some(
        (route) => route.kind === "tryout-exam" && route.examKey === "tka"
      )
    ).toBe(false);
  });

  it("does not publish tracks or sets without authored questions", () => {
    const source = TRYOUT_SOURCES.find(
      (candidate) => candidate.examKey === "snbt"
    );
    const track = source?.tracks[0];
    const set = track?.sets[0];

    expect(source).toBeDefined();
    expect(track).toBeDefined();
    expect(set).toBeDefined();
    if (!(source && track && set)) {
      return;
    }

    const unreadySource = defineTryoutExamSource({
      ...source,
      tracks: [
        {
          ...track,
          sets: [{ ...set, sections: [] }],
        },
      ],
    });
    const routes = Effect.runSync(
      listPublicTryoutRoutes({ tryouts: [unreadySource] })
    );

    expect(routes.some((route) => route.kind === "tryout-country")).toBe(true);
    expect(routes.some((route) => route.kind === "tryout-exam")).toBe(true);
    expect(routes.some((route) => route.kind === "tryout-track")).toBe(false);
    expect(routes.some((route) => route.kind === "tryout-set")).toBe(false);
    expect(routes.some((route) => route.kind === "tryout-section")).toBe(false);
  });
});
