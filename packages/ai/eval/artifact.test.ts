import {
  renderArtifactEval,
  renderArtifactEvalFromMathData,
} from "@repo/ai/eval/artifact";
import type { MathData } from "@repo/math/schema/data";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("artifact eval rendering", () => {
  it("renders manifest-only transcript proof for derived artifacts", async () => {
    const output = await Effect.runPromise(renderArtifactEval());

    expect(output).toContain("part: data-artifact");
    expect(output).toContain("payload: learningArtifacts");
    expect(output).toContain("kind: coordinate-system-3d");
  });

  it("reports no artifact for unverified math evidence", async () => {
    const output = await Effect.runPromise(
      renderArtifactEvalFromMathData(mathData({ status: "inconclusive" }))
    );

    expect(output).toBe("artifact: none");
  });
});

/** Builds point-geometry math evidence for artifact eval tests. */
function mathData({
  status = "verified",
}: {
  readonly status?: "inconclusive" | "verified";
} = {}): MathData {
  const input = {
    kind: "math",
    operation: "line",
    points: [
      { x: "0", y: "0" },
      { x: "3", y: "2" },
    ],
  } satisfies MathData["input"];

  return {
    input,
    kind: "line",
    result: {
      conditions: [],
      input,
      items: [],
      kind: "line",
      operation: "line",
      primary: {
        expression: "line through points",
        latex: "line",
      },
      reason: "CAS verified the coordinate geometry result.",
      stepStatus: "complete",
      steps: [],
      status,
    },
    status,
    summary: status,
  };
}
