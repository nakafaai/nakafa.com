// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import { SKIPPED, uncovered } from "#catalog/skipped";

const skippedModules = Arr.map(SKIPPED, (skip) => `${skip.path}/part`);

describe("uncovered", () => {
  it("passes when every module is a card's source or skipped by its own path or folder", () => {
    expect(
      uncovered(
        [...skippedModules, "components/ui/button"],
        ["components/ui/button"]
      )
    ).toEqual([]);
  });

  it("names a module that has neither a card nor a reason", () => {
    expect(uncovered([...skippedModules, "components/ui/rating"], [])).toEqual([
      "components/ui/rating has no card. Add one in catalog/cards, or name it in catalog/skipped.ts with its reason.",
    ]);
  });

  it("names a skip that matches no module", () => {
    const [first, ...rest] = skippedModules;
    expect(first).toBeDefined();
    expect(uncovered(rest, [])).toEqual([
      `catalog/skipped.ts names ${SKIPPED[0]?.path}, which no module is.`,
    ]);
  });
});
