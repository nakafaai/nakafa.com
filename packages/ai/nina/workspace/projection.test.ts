import { PedagogyMove } from "@repo/ai/nina/pedagogy/schema";
import {
  CapabilityContribution,
  EvidenceWorkspace,
  WorkspaceEvidenceEnvelope,
} from "@repo/ai/nina/workspace/schema";
import { decodeLearningArtifact } from "@repo/math/schema/artifact/schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { formatEvidenceWorkspaceProjection } from "./projection";

describe("nina/workspace/projection", () => {
  it("omits empty workspaces from continuation prompts", () => {
    const workspace = EvidenceWorkspace.make({
      contributions: [],
      createdAt: 1,
      turnId: "turn-projection-empty",
    });

    expect(formatEvidenceWorkspaceProjection(workspace)).toBeUndefined();
  });

  it("formats bounded evidence summaries without raw artifact payloads", () => {
    const workspace = EvidenceWorkspace.make({
      contributions: [
        CapabilityContribution.make({
          capability: "math",
          evidence: WorkspaceEvidenceEnvelope.make({
            capability: "math",
            refs: ["artifact-coordinate-system"],
            status: "available",
            summary: "Verified the plotted function and intercepts.",
          }),
          modelSummary: "Use y = 2x + 1 with intercept (0, 1).",
        }),
      ],
      createdAt: 1,
      turnId: "turn-projection-math",
    });

    const projection = formatEvidenceWorkspaceProjection(workspace);

    expect(projection).toContain("# Evidence Workspace Projection");
    expect(projection).toContain("Capability: math");
    expect(projection).toContain("References: artifact-coordinate-system");
    expect(projection).toContain("Use y = 2x + 1 with intercept (0, 1).");
    expect(projection).not.toContain("payload");
    expect(projection).not.toContain("primitives");
  });

  it("includes bounded limitations, pedagogy moves, and artifact identifiers", async () => {
    const artifact = await Effect.runPromise(
      decodeLearningArtifact(createCoordinateArtifact())
    );
    const workspace = EvidenceWorkspace.make({
      contributions: [
        CapabilityContribution.make({
          artifacts: [artifact],
          capability: "nakafa",
          evidence: WorkspaceEvidenceEnvelope.make({
            capability: "nakafa",
            limitations: ["Current page was unavailable."],
            status: "limited",
            summary: "Selected a fallback lesson sequence.",
          }),
          modelSummary: "Use the fallback lesson before giving practice.",
          pedagogyMoves: [
            PedagogyMove.make({
              evidenceRefs: ["artifact-coordinate-1"],
              kind: "scaffold",
              summary: "Start with axis labels before graphing.",
            }),
          ],
        }),
      ],
      createdAt: 1,
      turnId: "turn-projection-full",
    });

    const projection = formatEvidenceWorkspaceProjection(workspace);

    expect(projection).toContain("Limitations: Current page was unavailable.");
    expect(projection).toContain(
      "Pedagogy: scaffold: Start with axis labels before graphing."
    );
    expect(projection).toContain("Artifacts: artifact-coordinate-1");
    expect(projection).not.toContain("Coordinate artifact");
  });
});

/**
 * Builds the smallest valid coordinate artifact needed by projection tests.
 */
function createCoordinateArtifact() {
  return {
    id: "artifact-coordinate-1",
    kind: "coordinate-system-3d",
    payload: {
      axes: {
        x: [scalar("-5"), scalar("5")],
        y: [scalar("-5"), scalar("5")],
        z: [scalar("-5"), scalar("5")],
      },
      primitives: [
        {
          id: "origin",
          kind: "point",
          point: point("0", "0", "0"),
        },
      ],
      sampling: {
        curveSamples: 64,
        surfaceCells: 32,
      },
    },
    proofAnchors: ["cas://coordinate/artifact-1"],
    title: "Coordinate artifact",
  };
}

/**
 * Creates an exact scalar literal for deterministic coordinate fixtures.
 */
function scalar(expression: string) {
  return { expression, latex: expression };
}

/**
 * Creates a 3D exact point without introducing reusable test builders.
 */
function point(x: string, y: string, z: string) {
  return {
    x: scalar(x),
    y: scalar(y),
    z: scalar(z),
  };
}
