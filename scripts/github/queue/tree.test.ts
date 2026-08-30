import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import {
  isCiSensitivePath,
  validateQueueTree,
} from "#scripts/github/queue/tree";

const BASE_SHA = "1".repeat(40);
const GROUP_SHA = "2".repeat(40);
const PULL_SHA = "3".repeat(40);
const TREE_SHA = "4".repeat(40);

const identity = {
  actor: "nabilfatih",
  baseBranch: "main",
  baseSha: BASE_SHA,
  groupRef: `refs/heads/gh-readonly-queue/main/pr-42-${BASE_SHA}`,
  groupSha: GROUP_SHA,
  pullNumber: 42,
  repository: "nakafaai/nakafa.com",
  sender: "nabilfatih",
};

const reusableEvidence = {
  actualHead: GROUP_SHA,
  actualTree: TREE_SHA,
  changedPaths: ["apps/www/components/sidebar/guest.tsx"],
  expectedTree: TREE_SHA,
  mergeBase: BASE_SHA,
  parentLine: `${GROUP_SHA} ${BASE_SHA}`,
  sourceTree: TREE_SHA,
};

describe("merge queue tree", () => {
  it("classifies workflow and toolchain changes as CI-sensitive", () => {
    expect(isCiSensitivePath(".github/workflows/ci.yml")).toBe(true);
    expect(isCiSensitivePath("scripts/github/queue/tree.ts")).toBe(true);
    expect(isCiSensitivePath("apps/www/package.json")).toBe(true);
    expect(isCiSensitivePath("apps/www/vitest.config.mts")).toBe(true);
    expect(isCiSensitivePath("apps/www/components/sidebar/guest.tsx")).toBe(
      false
    );
  });

  it.effect(
    "reuses proof only for the exact source tree on the exact base",
    () =>
      Effect.gen(function* () {
        expect(
          yield* validateQueueTree(identity, PULL_SHA, reusableEvidence)
        ).toEqual({
          changedPaths: reusableEvidence.changedPaths,
          reuse: true,
        });
        expect(
          yield* validateQueueTree(identity, PULL_SHA, {
            ...reusableEvidence,
            changedPaths: ["package.json"],
          })
        ).toMatchObject({ reuse: false });
        expect(
          yield* validateQueueTree(identity, PULL_SHA, {
            ...reusableEvidence,
            mergeBase: "5".repeat(40),
          })
        ).toMatchObject({ reuse: false });
      })
  );

  it.effect("rejects a synthetic tree containing unrelated changes", () =>
    validateQueueTree(identity, PULL_SHA, {
      ...reusableEvidence,
      actualTree: "6".repeat(40),
    }).pipe(
      Effect.result,
      Effect.tap((result) =>
        Effect.sync(() => {
          expect(Result.isFailure(result)).toBe(true);
        })
      )
    )
  );
});
