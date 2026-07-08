import { readIncrementalSyncPlan } from "@repo/backend/scripts/sync-content/workflow/plan";
import { describe, expect, it } from "vitest";

describe("readIncrementalSyncPlan", () => {
  it("plans curriculum and try-out row resyncs when route projection modules change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/route/tryout.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("normalizes absolute route projection paths before planning row resyncs", () => {
    expect(
      readIncrementalSyncPlan([
        "/Users/nabilfatih/.codex/worktrees/5c82/nakafa.com/packages/contents/_types/route/tryout.ts",
      ])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans every content row surface when graph projection modules change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/graph/projection.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("normalizes absolute graph projection paths before planning every row surface", () => {
    expect(
      readIncrementalSyncPlan([
        "/Users/nabilfatih/.codex/worktrees/5c82/nakafa.com/packages/contents/_types/graph/projection.ts",
      ])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans curriculum and try-out rows when shared material route domains change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/material/domain.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans curriculum and try-out rows when shared material registry entries change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/material/source.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans every row surface when shared taxonomy contracts change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/taxonomy.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans every row surface when shared content row contracts change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/content.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["articles", "curriculum", "tryouts"],
    });
  });

  it("plans curriculum and try-out rows when program catalog entries change", () => {
    expect(
      readIncrementalSyncPlan(["packages/contents/_types/program/catalog.ts"])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["curriculum", "tryouts"],
    });
  });

  it("plans try-out rows when try-out source content changes", () => {
    expect(
      readIncrementalSyncPlan([
        "packages/contents/question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question.id.mdx",
      ])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["tryouts"],
    });
  });

  it("normalizes content-root relative try-out paths before planning row resyncs", () => {
    expect(
      readIncrementalSyncPlan([
        "question-bank/tryout/indonesia/snbt/general-reasoning/set-1/question-1/question.id.mdx",
      ])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: true,
      rowPhases: ["tryouts"],
    });
  });

  it("does not refresh generated read models for article-only changes", () => {
    expect(
      readIncrementalSyncPlan([
        "packages/contents/articles/politics/how-policy-works.id.mdx",
      ])
    ).toEqual({
      cleanBeforeRouteArtifacts: true,
      refreshGeneratedReadModels: false,
      rowPhases: ["articles"],
    });
  });
});
