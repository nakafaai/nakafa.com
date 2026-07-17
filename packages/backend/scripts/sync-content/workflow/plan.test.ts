import { readIncrementalSyncPlan } from "@repo/backend/scripts/sync-content/workflow/plan";
import { describe, expect, it } from "vitest";

const materialAndTryoutTargets = [
  { locale: "en", section: "material" },
  { locale: "id", section: "material" },
  { locale: "en", section: "tryout" },
  { locale: "id", section: "tryout" },
];

const everyRouteArtifactTarget = [
  { locale: "en", section: "articles" },
  { locale: "id", section: "articles" },
  ...materialAndTryoutTargets,
  { locale: "en", section: "quran" },
  { locale: "id", section: "quran" },
];

describe("readIncrementalSyncPlan", () => {
  it("plans curriculum and try-out row resyncs when route projection modules change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/route/tryout.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: materialAndTryoutTargets,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("normalizes absolute route projection paths before planning row resyncs", () => {
    expect(
      readIncrementalSyncPlan([
        "/Users/nabilfatih/.codex/worktrees/5c82/nakafa.com/packages/contents/_types/route/tryout.ts",
      ])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: materialAndTryoutTargets,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans every content row surface when graph projection modules change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/graph/projection.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: true,
      routeArtifactTargets: everyRouteArtifactTarget,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans every content row surface when graph identity changes", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/learning-graph.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: true,
      routeArtifactTargets: everyRouteArtifactTarget,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("normalizes absolute graph projection paths before planning every row surface", () => {
    expect(
      readIncrementalSyncPlan([
        "/Users/nabilfatih/.codex/worktrees/5c82/nakafa.com/packages/contents/_types/graph/projection.ts",
      ])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: true,
      routeArtifactTargets: everyRouteArtifactTarget,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans curriculum and try-out rows when shared material route domains change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/material/domain.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: materialAndTryoutTargets,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans curriculum and try-out rows when shared material registry entries change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/material/source.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: materialAndTryoutTargets,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans every row surface when shared taxonomy contracts change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/taxonomy.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: true,
      routeArtifactTargets: everyRouteArtifactTarget,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans every row surface when shared content row contracts change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/content.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: true,
      routeArtifactTargets: everyRouteArtifactTarget,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans date-dependent rows and route artifacts when shared date parsing changes", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_shared/date.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: [
        { locale: "en", section: "articles" },
        { locale: "id", section: "articles" },
        { locale: "en", section: "material" },
        { locale: "id", section: "material" },
      ],
      rowPhases: ["articles", "curriculum"],
    });
  });

  it("plans curriculum and try-out rows when program catalog entries change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/program/catalog.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: materialAndTryoutTargets,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans try-out rows when try-out source content changes", () => {
    expect(
      readIncrementalSyncPlan([
        "packages/contents/question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question.id.mdx",
      ])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: [{ locale: "id", section: "tryout" }],
      rowPhases: ["tryouts"],
    });
  });

  it("normalizes content-root relative try-out paths before planning row resyncs", () => {
    expect(
      readIncrementalSyncPlan([
        "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question.id.mdx",
      ])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: [{ locale: "id", section: "tryout" }],
      rowPhases: ["tryouts"],
    });
  });

  it("refreshes article-owned public routes for article changes", () => {
    expect(
      readIncrementalSyncPlan([
        "packages/contents/articles/politics/how-policy-works.id.mdx",
      ])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: [{ locale: "id", section: "articles" }],
      rowPhases: ["articles"],
    });
  });

  it("plans only Quran rows and shared route artifacts for Quran changes", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/quran/source.ts"])
    ).toEqual({
      refreshPublicRoutes: false,
      refreshQuran: true,
      routeArtifactTargets: [
        { locale: "en", section: "quran" },
        { locale: "id", section: "quran" },
      ],
      rowPhases: [],
    });
  });

  it.each([
    "packages/contents/_lib/quran.ts",
    "packages/contents/_types/quran.ts",
  ])("plans Quran projections for shared source %s", (sourcePath) => {
    expect(readIncrementalSyncPlan([sourcePath])).toEqual({
      refreshPublicRoutes: false,
      refreshQuran: true,
      routeArtifactTargets: [
        { locale: "en", section: "quran" },
        { locale: "id", section: "quran" },
      ],
      rowPhases: [],
    });
  });

  it("refreshes article category public routes when its source changes", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/articles/category.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: [
        { locale: "en", section: "articles" },
        { locale: "id", section: "articles" },
      ],
      rowPhases: ["articles"],
    });
  });

  it("resyncs every article locale when official team membership changes", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/team/source.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      refreshQuran: false,
      routeArtifactTargets: [
        { locale: "en", section: "articles" },
        { locale: "id", section: "articles" },
      ],
      rowPhases: ["articles"],
    });
  });
});
