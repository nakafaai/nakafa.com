import { capabilityResult } from "@repo/ai/nina/capability/result";
import {
  EvidenceEnvelope,
  LearningCapabilityResult,
} from "@repo/ai/nina/capability/spec";
import { deriveCoordinateArtifactsFromMathData } from "@repo/math/artifact/derive";
import type { MathData } from "@repo/math/schema/data";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createNinaWorkspaceRuntime } from "./runtime";

describe("nina/workspace/runtime", () => {
  it("appends capability results to the turn-local workspace", async () => {
    const workspace = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-append",
        });

        yield* runtime.appendResult(
          capabilityResult({
            capability: "nakafa",
            limitations: [" ", "Current page fetch was skipped."],
            refs: ["lesson:coordinate-system"],
            status: "available",
            text: "Nakafa selected the coordinate-system lesson.",
          })
        );

        return yield* runtime.readWorkspace();
      })
    );

    expect(workspace.contributions).toHaveLength(1);
    expect(workspace.contributions[0]?.capability).toBe("nakafa");
    expect(workspace.contributions[0]?.evidence.refs).toEqual([
      "lesson:coordinate-system",
    ]);
    expect(workspace.contributions[0]?.evidence.limitations).toEqual([
      "Current page fetch was skipped.",
    ]);
  });

  it("projects appended evidence for later model steps", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-projection",
        });

        yield* runtime.appendResult(
          capabilityResult({
            capability: "math",
            status: "available",
            text: "Math verified slope 2 and y-intercept 1.",
          })
        );

        return {
          artifacts: yield* runtime.readArtifacts(),
          projection: yield* runtime.readProjection(),
        };
      })
    );

    expect(result.artifacts).toEqual([]);
    expect(result.projection).toContain("Capability: math");
    expect(result.projection).toContain(
      "Math verified slope 2 and y-intercept 1."
    );
  });

  it("retains full artifact payloads for persistence while projecting ids only", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const [artifact] = yield* deriveCoordinateArtifactsFromMathData({
          artifactId: "artifact-runtime-1",
          data: mathData(),
          proofAnchor: "math:tool-call",
        });
        if (!artifact) {
          return { artifacts: [], projection: undefined };
        }

        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-artifact",
        });

        yield* runtime.appendResult(
          capabilityResult({
            artifacts: [artifact],
            capability: "math",
            status: "available",
            text: "Math derived a coordinate artifact.",
          })
        );

        return {
          artifacts: yield* runtime.readArtifacts(),
          projection: yield* runtime.readProjection(),
        };
      })
    );

    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]?.id).toBe("artifact-runtime-1");
    expect(result.projection).toContain("Artifacts: artifact-runtime-1");
    expect(result.projection).not.toContain("primitives");
  });

  it("uses text or status fallback when capability summaries are blank", async () => {
    const projection = await Effect.runPromise(
      Effect.gen(function* () {
        const runtime = yield* createNinaWorkspaceRuntime({
          turnId: "turn-runtime-summary",
        });

        yield* runtime.appendResult(
          LearningCapabilityResult.make({
            evidence: EvidenceEnvelope.make({
              capability: "deepResearch",
              status: "limited",
              summary: " ",
            }),
            text: "Use only official sources already cited.",
          })
        );
        yield* runtime.appendResult(
          LearningCapabilityResult.make({
            evidence: EvidenceEnvelope.make({
              capability: "math",
              status: "failed",
              summary: " ",
            }),
            text: " ",
          })
        );

        return yield* runtime.readProjection();
      })
    );

    expect(projection).toContain("Use only official sources already cited.");
    expect(projection).toContain("math returned failed evidence.");
  });
});

/** Builds verified coordinate evidence used by workspace artifact tests. */
function mathData(): MathData {
  const input = {
    kind: "math",
    operation: "line",
    points: [
      { x: "0", y: "1" },
      { x: "4", y: "3" },
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
      status: "verified",
    },
    status: "verified",
    summary: "verified",
  };
}
