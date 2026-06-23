import { buildLearningArtifactManifest } from "@repo/ai/schema/artifact";
import type { MyUIMessage } from "@repo/ai/types/message";
import { deriveCoordinateArtifactsFromMathData } from "@repo/math/artifact/derive";
import type { MathData } from "@repo/math/schema/data";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { readArtifactWritesForMessage } from "./artifact";

describe("nina/runtime/artifact", () => {
  it("pairs streamed artifact manifests with durable payload writes", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const artifacts = yield* deriveCoordinateArtifactsFromMathData({
          artifactId: "artifact-runtime-write",
          data: mathData(),
          proofAnchor: "math:tool-runtime-write",
        });
        const artifact = artifacts[0];
        if (!artifact) {
          return { artifactId: undefined, writes: [] };
        }

        const manifest = yield* buildLearningArtifactManifest(artifact);
        const message = {
          id: "assistant-artifact",
          parts: [
            { state: "done", text: "Here is the graph.", type: "text" },
            { data: manifest, id: artifact.id, type: "data-artifact" },
          ],
          role: "assistant",
        } satisfies MyUIMessage;

        return {
          artifactId: artifact.id,
          writes: yield* readArtifactWritesForMessage({
            artifacts,
            message,
          }),
        };
      })
    );

    expect(result.writes).toHaveLength(1);
    expect(result.writes[0]).toMatchObject({
      artifact: { id: result.artifactId },
      partOrder: 1,
    });
  });

  it("returns no writes when the workspace has no artifacts", async () => {
    const writes = await Effect.runPromise(
      readArtifactWritesForMessage({
        artifacts: [],
        message: { id: "assistant-empty", parts: [], role: "assistant" },
      })
    );

    expect(writes).toEqual([]);
  });

  it("leaves unmatched manifests for Convex coverage validation", async () => {
    const writes = await Effect.runPromise(
      Effect.gen(function* () {
        const [artifact] = yield* deriveCoordinateArtifactsFromMathData({
          artifactId: "artifact-orphan-manifest",
          data: mathData(),
          proofAnchor: "math:tool-orphan",
        });
        if (!artifact) {
          return [];
        }

        const manifest = yield* buildLearningArtifactManifest(artifact);
        const orphanManifest = {
          ...manifest,
          artifactId: "missing-artifact-payload",
        };
        const message = {
          id: "assistant-orphan",
          parts: [
            { data: orphanManifest, id: artifact.id, type: "data-artifact" },
          ],
          role: "assistant",
        } satisfies MyUIMessage;

        return yield* readArtifactWritesForMessage({
          artifacts: [artifact],
          message,
        });
      })
    );

    expect(writes).toEqual([]);
  });
});

/** Builds verified coordinate math evidence for runtime artifact tests. */
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
