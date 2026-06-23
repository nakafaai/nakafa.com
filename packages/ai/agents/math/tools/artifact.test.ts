import { emitLearningArtifacts } from "@repo/ai/agents/math/tools/artifact";
import type { MyUIMessage } from "@repo/ai/types/message";
import { deriveCoordinateArtifactsFromMathData } from "@repo/math/artifact/derive";
import type { MathData } from "@repo/math/schema/data";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("emitLearningArtifacts", () => {
  it("does not write manifest parts for empty artifact batches", async () => {
    const parts: unknown[] = [];
    const emitted = await Effect.runPromise(
      emitLearningArtifacts({
        artifacts: [],
        writer: writerFor(parts),
      })
    );

    expect(emitted).toEqual([]);
    expect(parts).toEqual([]);
  });

  it("writes manifest parts for retained artifacts", async () => {
    const artifact = await readArtifact("artifact-with-manifest");
    const parts: unknown[] = [];
    const emitted = await Effect.runPromise(
      emitLearningArtifacts({
        artifacts: [artifact],
        writer: writerFor(parts),
      })
    );

    expect(emitted).toEqual([artifact]);
    expect(parts).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          artifactId: artifact.id,
          kind: "coordinate-system-3d",
        }),
        id: artifact.id,
        type: "data-artifact",
      }),
    ]);
  });
});

/** Creates the minimal writer capability needed by the artifact emitter. */
function writerFor(parts: unknown[]) {
  return {
    write: (
      part: Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0]
    ) => {
      parts.push(part);
    },
  };
}

/** Derives one validated coordinate artifact for emitter tests. */
async function readArtifact(id: string) {
  const artifacts = await Effect.runPromise(
    deriveCoordinateArtifactsFromMathData({
      artifactId: id,
      data: mathData(),
      proofAnchor: `math:${id}`,
    })
  );
  const artifact = artifacts[0];
  if (!artifact) {
    expect.fail(
      "Expected coordinate artifact derivation to emit one artifact."
    );
  }

  return artifact;
}

/** Builds verified point-geometry math evidence for emitter tests. */
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
