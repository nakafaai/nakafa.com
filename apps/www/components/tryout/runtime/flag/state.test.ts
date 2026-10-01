import { describe, expect, it } from "@effect/vitest";
import { applyOptimisticTryoutFlag } from "@/components/tryout/runtime/flag/state";
import { makeTryoutQuestion, makeTryoutRuntime } from "@/test/tryout";

describe("try-out flag state", () => {
  it("flags and clears only the targeted placement", () => {
    const other = makeTryoutQuestion("b");
    const runtime = makeTryoutRuntime([makeTryoutQuestion("a"), other]);
    const flagged = applyOptimisticTryoutFlag(runtime, {
      flagged: true,
      placementId: runtime.questions[0].placementId,
    });
    expect(flagged?.questions.map((question) => question.flagged)).toEqual([
      true,
      false,
    ]);
    expect(flagged?.questions[1]).toBe(other);
    expect(
      applyOptimisticTryoutFlag(flagged ?? runtime, {
        flagged: false,
        placementId: runtime.questions[0].placementId,
      })?.questions[0].flagged
    ).toBe(false);
  });

  it("leaves a runtime without the placement untouched", () => {
    const runtime = makeTryoutRuntime([makeTryoutQuestion("a")]);
    expect(
      applyOptimisticTryoutFlag(runtime, {
        flagged: true,
        placementId: makeTryoutQuestion("missing").placementId,
      })
    ).toBeNull();
  });
});
