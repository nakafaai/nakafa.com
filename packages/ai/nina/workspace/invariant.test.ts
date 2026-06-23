// @vitest-environment node

import {
  MATH_CAPABILITY,
  NAKAFA_CAPABILITY,
} from "@repo/ai/nina/capability/spec";
import { PedagogyMove } from "@repo/ai/nina/pedagogy/schema";
import { findWorkspaceIssue } from "@repo/ai/nina/workspace/invariant";
import {
  CapabilityContribution,
  EvidenceWorkspace,
  WorkspaceEvidenceEnvelope,
} from "@repo/ai/nina/workspace/schema";
import {
  CoordinateSystemArtifact,
  CoordinateSystemPayload,
} from "@repo/math/schema/artifact/schema";
import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import { RenderSamplingPolicy } from "@repo/math/schema/coordinate/primitive";
import { describe, expect, it } from "vitest";

describe("EvidenceWorkspace invariant ownership", () => {
  it("rejects contribution/evidence capability mismatches", () => {
    expect(
      findWorkspaceIssue(
        workspace([
          contribution({
            evidenceCapability: NAKAFA_CAPABILITY,
          }),
        ])
      )
    ).toBe(
      "Contribution capability math does not match evidence capability nakafa."
    );
  });

  it("rejects unavailable evidence that attaches artifacts or pedagogy", () => {
    expect(
      findWorkspaceIssue(
        workspace([
          contribution({
            artifacts: [artifact("artifact-from-failed-evidence")],
            evidenceStatus: "failed",
          }),
        ])
      )
    ).toBe(
      "Contribution math cannot attach artifacts when evidence status is failed."
    );

    expect(
      findWorkspaceIssue(
        workspace([
          contribution({
            evidenceStatus: "denied",
            pedagogyMoves: [move("cas://math/evaluate")],
          }),
        ])
      )
    ).toBe(
      "Contribution math cannot attach pedagogy moves when evidence status is denied."
    );

    expect(
      findWorkspaceIssue(
        workspace([
          contribution({
            evidenceStatus: "failed",
          }),
        ])
      )
    ).toBeUndefined();
  });

  it("rejects duplicate artifact ids across contributions", () => {
    expect(
      findWorkspaceIssue(
        workspace([
          contribution({ artifacts: [artifact("artifact-1")] }),
          contribution({ artifacts: [artifact("artifact-1")] }),
        ])
      )
    ).toBe("Duplicate learning artifact id: artifact-1.");
  });

  it("requires pedagogy refs to be grounded in contribution refs or artifacts", () => {
    expect(
      findWorkspaceIssue(
        workspace([
          contribution({
            pedagogyMoves: [move("missing-ref")],
          }),
        ])
      )
    ).toBe(
      "Pedagogy move verification-note references unknown evidence missing-ref."
    );

    expect(
      findWorkspaceIssue(
        workspace([
          contribution({
            artifacts: [artifact("artifact-only")],
            evidenceRefs: undefined,
            pedagogyMoves: [move("artifact-only")],
          }),
        ])
      )
    ).toBeUndefined();
  });
});

function workspace(contributions: CapabilityContribution[]) {
  return EvidenceWorkspace.make({
    contributions,
    createdAt: 1_782_195_600,
    turnId: "turn-1",
  });
}

function contribution(
  input: {
    artifacts?: readonly CoordinateSystemArtifact[];
    evidenceCapability?: typeof MATH_CAPABILITY | typeof NAKAFA_CAPABILITY;
    evidenceRefs?: readonly string[];
    evidenceStatus?: "available" | "denied" | "failed";
    pedagogyMoves?: readonly PedagogyMove[];
  } = {}
) {
  return CapabilityContribution.make({
    artifacts: input.artifacts ? [...input.artifacts] : undefined,
    capability: MATH_CAPABILITY,
    evidence: WorkspaceEvidenceEnvelope.make({
      capability: input.evidenceCapability ?? MATH_CAPABILITY,
      refs: input.evidenceRefs ? [...input.evidenceRefs] : undefined,
      status: input.evidenceStatus ?? "available",
      summary: "CAS verified the coordinate relation.",
    }),
    modelSummary: "CAS verified the coordinate relation.",
    pedagogyMoves: input.pedagogyMoves ? [...input.pedagogyMoves] : undefined,
  });
}

function move(evidenceRef: string) {
  return PedagogyMove.make({
    evidenceRefs: [evidenceRef],
    kind: "verification-note",
    summary: "Anchor the explanation in verified evidence.",
  });
}

function artifact(id: string) {
  return CoordinateSystemArtifact.make({
    id,
    kind: "coordinate-system-3d",
    payload: CoordinateSystemPayload.make({
      axes: {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("-1"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
      primitives: [
        {
          id: "point-1",
          kind: "point",
          point: point("0", "0", "0"),
        },
      ],
      sampling: RenderSamplingPolicy.make({
        curveSamples: 16,
        surfaceCells: 16,
      }),
    }),
    proofAnchors: ["cas://coordinate/artifact"],
    title: "Coordinate artifact",
  });
}

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({
    x: scalar(x),
    y: scalar(y),
    z: scalar(z),
  });
}

function scalar(expression: string) {
  return ExactScalar.make({
    expression,
    latex: expression,
  });
}
