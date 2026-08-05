import { readIncrementalSyncPlan } from "@repo/backend/scripts/sync-content/workflow/plan";
import { describe, expect, it } from "vitest";

const articleTargets = [
  { locale: "en", section: "articles" },
  { locale: "id", section: "articles" },
];
const materialTargets = [
  { locale: "en", section: "material" },
  { locale: "id", section: "material" },
];
const everyOwnedTarget = [...articleTargets, ...materialTargets];

describe("readIncrementalSyncPlan", () => {
  it.each([
    "packages/contents/_types/route/path.ts",
    "/tmp/worktree/packages/contents/_types/route/path.ts",
    "packages/contents/_types/material/domain.ts",
    "packages/contents/_types/material/source.ts",
    "packages/contents/_types/program/catalog.ts",
  ])("plans curriculum rows for material contract %s", (sourcePath) => {
    expect(readIncrementalSyncPlan([sourcePath])).toEqual({
      refreshPublicRoutes: true,
      routeArtifactTargets: materialTargets,
      rowPhases: ["curriculum"],
    });
  });

  it.each([
    "packages/contents/_types/graph/projection.ts",
    "/tmp/worktree/packages/contents/_types/graph/projection.ts",
    "packages/contents/_types/learning-graph.ts",
    "packages/contents/_types/taxonomy.ts",
    "packages/contents/_types/content.ts",
  ])("plans every owned row surface for shared contract %s", (sourcePath) => {
    expect(readIncrementalSyncPlan([sourcePath])).toEqual({
      refreshPublicRoutes: true,
      routeArtifactTargets: everyOwnedTarget,
      rowPhases: ["articles", "curriculum"],
    });
  });

  it("plans dated article and material projections together", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_shared/date.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      routeArtifactTargets: everyOwnedTarget,
      rowPhases: ["articles", "curriculum"],
    });
  });

  it("targets only the localized article artifact for article source changes", () => {
    expect(
      readIncrementalSyncPlan([
        "packages/contents/articles/politics/how-policy-works.id.mdx",
      ])
    ).toEqual({
      refreshPublicRoutes: true,
      routeArtifactTargets: [{ locale: "id", section: "articles" }],
      rowPhases: ["articles"],
    });
  });

  it("targets every article locale for official team membership changes", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/team/source.ts"])
    ).toEqual({
      refreshPublicRoutes: true,
      routeArtifactTargets: articleTargets,
      rowPhases: ["articles"],
    });
  });

  it("ignores Aksara-owned source families", () => {
    expect(
      readIncrementalSyncPlan([
        "packages/contents/quran/source.ts",
        "packages/contents/tryout/source.ts",
      ])
    ).toEqual({
      refreshPublicRoutes: false,
      routeArtifactTargets: [],
      rowPhases: [],
    });
  });
});
