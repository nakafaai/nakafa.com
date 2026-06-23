import { buildLearningArtifactManifest } from "@repo/ai/schema/artifact";
import { deriveCoordinateArtifactsFromMathData } from "@repo/math/artifact/derive";
import type { MathData } from "@repo/math/schema/data";
import { Effect } from "effect";

/**
 * Renders the coordinate artifact eval through derivation and manifest seams.
 */
export const renderArtifactEval = Effect.fn("eval.renderArtifactCase")(
  function* () {
    return yield* renderArtifactEvalFromMathData(createArtifactMathData());
  }
);

/**
 * Renders artifact eval proof from deterministic math evidence.
 */
export const renderArtifactEvalFromMathData = Effect.fn(
  "eval.renderArtifactCaseFromMathData"
)(function* (data: MathData) {
  const [artifact] = yield* deriveCoordinateArtifactsFromMathData({
    artifactId: "eval-coordinate-artifact",
    data,
    proofAnchor: "math:eval-coordinate",
  });
  if (!artifact) {
    return "artifact: none";
  }

  const manifest = yield* buildLearningArtifactManifest(artifact);
  return [
    "part: data-artifact",
    "payload: learningArtifacts",
    `artifactId: ${manifest.artifactId}`,
    `kind: ${manifest.kind}`,
    `primitiveCount: ${manifest.primitiveCount}`,
  ].join("\n");
});

/**
 * Creates verified point-geometry math data for artifact eval proof.
 */
function createArtifactMathData(): MathData {
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
      status: "verified",
    },
    status: "verified",
    summary: "verified",
  };
}
