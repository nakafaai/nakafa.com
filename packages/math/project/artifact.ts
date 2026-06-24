import type { VisualIntent } from "@repo/math/schema/artifact";
import { MathWorkArtifact } from "@repo/math/schema/artifact";
import type { MathCopyKey } from "@repo/math/schema/copy";
import type { VerificationLane } from "@repo/math/schema/lane";
import type { MathOperation } from "@repo/math/schema/operations";
import type { MathResult } from "@repo/math/schema/result";
import type { MathWorkStep } from "@repo/math/schema/step";
import type { MathWork } from "@repo/math/schema/work";

/** Projects canonical MathWork into compact UI artifact manifests. */
export function projectArtifacts({
  lane,
  result,
  steps,
  work,
}: {
  readonly lane: VerificationLane;
  readonly result: MathResult;
  readonly steps: readonly MathWorkStep[];
  readonly work: MathWork;
}) {
  const artifacts = [
    MathWorkArtifact.make({
      artifactId: `${work.workId}:formula`,
      kind: "formula-card",
      manifest: {
        expressionRefs: ["primaryResult"],
        kind: "formula-card",
      },
      titleKey: titleKeyForOperation(result.operation),
      verificationLane: lane,
      workId: work.workId,
    }),
  ];

  if (steps.length > 0) {
    artifacts.push(
      MathWorkArtifact.make({
        artifactId: `${work.workId}:steps`,
        kind: "step-list",
        manifest: {
          kind: "step-list",
          projectionLevel: "school",
          stepOrders: steps.map((step) => step.order),
        },
        titleKey: "math-work-steps-title",
        verificationLane: lane,
        workId: work.workId,
      })
    );
  }

  const visualIntent = visualIntentForResult({ lane, result });
  if (visualIntent) {
    artifacts.push(
      MathWorkArtifact.make({
        artifactId: `${work.workId}:visual`,
        kind: "visual-intent",
        manifest: {
          kind: "visual-intent",
          visualIntent,
        },
        titleKey: "math-work-visual-title",
        verificationLane: visualIntent.verificationLane,
        workId: work.workId,
      })
    );
  }

  return artifacts;
}

/** Builds the optional coordinate visual intent from CAS-backed evidence. */
function visualIntentForResult({
  lane,
  result,
}: {
  readonly lane: VerificationLane;
  readonly result: MathResult;
}): VisualIntent | undefined {
  if (result.operation !== "line" && result.operation !== "circle") {
    return;
  }

  return {
    descriptionKey: visualDescriptionKey(result.operation),
    expressions: [result.secondary ?? result.primary],
    kind: result.operation === "line" ? "coordinate-line" : "coordinate-circle",
    source: `cas.${result.operation}`,
    verificationLane: lane,
  };
}

/** Returns the dictionary key used for the primary operation artifact title. */
function titleKeyForOperation(operation: MathOperation): MathCopyKey {
  return `math-${operation}`;
}

/** Returns the dictionary key used for coordinate visual descriptions. */
function visualDescriptionKey(
  operation: Extract<MathOperation, "circle" | "line">
): MathCopyKey {
  if (operation === "circle") {
    return "math-visual-coordinate-circle-description";
  }

  return "math-visual-coordinate-line-description";
}
