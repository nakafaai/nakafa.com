// @vitest-environment node

import {
  EvidenceEnvelope,
  MATH_CAPABILITY,
  NAKAFA_CAPABILITY,
} from "@repo/ai/nina/capability/spec";
import { PedagogyMove } from "@repo/ai/nina/pedagogy/schema";
import {
  appendCapabilityContribution,
  CapabilityContribution,
  createEvidenceWorkspace,
  decodeEvidenceWorkspace,
  EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
  EvidenceWorkspace,
  EvidenceWorkspaceDecodeError,
  EvidenceWorkspaceLimitExceeded,
} from "@repo/ai/nina/workspace/schema";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("EvidenceWorkspace", () => {
  it("creates a workspace and appends a typed contribution", async () => {
    const workspace = await Effect.runPromise(
      createEvidenceWorkspace({
        createdAt: 1_782_195_600,
        turnId: "turn-1",
      })
    );
    const next = await Effect.runPromise(
      appendCapabilityContribution(workspace, createContribution())
    );

    expect(next).toBeInstanceOf(EvidenceWorkspace);
    expect(next.contributions).toHaveLength(1);
    expect(next.contributions[0]?.pedagogyMoves?.[0]).toBeInstanceOf(
      PedagogyMove
    );
  });

  it("rejects capability and evidence mismatches with a typed error", async () => {
    const workspace = await Effect.runPromise(
      createEvidenceWorkspace({
        createdAt: 1_782_195_600,
        turnId: "turn-1",
      })
    );
    const contribution = CapabilityContribution.make({
      capability: MATH_CAPABILITY,
      evidence: EvidenceEnvelope.make({
        capability: NAKAFA_CAPABILITY,
        status: "available",
        summary: "Retrieved relevant Nakafa material.",
      }),
      modelSummary: "Retrieved relevant Nakafa material.",
    });

    const exit = await Effect.runPromiseExit(
      appendCapabilityContribution(workspace, contribution)
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(EvidenceWorkspaceDecodeError);
    if (failure instanceof EvidenceWorkspaceDecodeError) {
      expect(failure.message).toBe(
        "Contribution capability math does not match evidence capability nakafa."
      );
    }
  });

  it("rejects invalid workspace schema shapes with a typed error", async () => {
    const exit = await Effect.runPromiseExit(
      decodeEvidenceWorkspace({
        contributions: [
          {
            capability: MATH_CAPABILITY,
          },
        ],
        createdAt: 1_782_195_600,
        turnId: "turn-1",
      })
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(EvidenceWorkspaceDecodeError);
    if (failure instanceof EvidenceWorkspaceDecodeError) {
      expect(failure.message).toBe("Invalid evidence workspace contract.");
    }
  });

  it("keeps contribution retention bounded with a typed limit error", async () => {
    const workspace = EvidenceWorkspace.make({
      contributions: Array.from(
        { length: EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT },
        createContribution
      ),
      createdAt: 1_782_195_600,
      turnId: "turn-1",
    });

    const exit = await Effect.runPromiseExit(
      appendCapabilityContribution(workspace, createContribution())
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(EvidenceWorkspaceLimitExceeded);
    if (failure instanceof EvidenceWorkspaceLimitExceeded) {
      expect(failure.limit).toBe(EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT);
    }
  });

  it("rejects duplicate artifact ids across contributions", async () => {
    const exit = await Effect.runPromiseExit(
      decodeEvidenceWorkspace({
        contributions: [
          createContributionInput({
            artifacts: [createArtifactInput("artifact-1")],
          }),
          createContributionInput({
            artifacts: [createArtifactInput("artifact-1")],
          }),
        ],
        createdAt: 1_782_195_600,
        turnId: "turn-1",
      })
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(EvidenceWorkspaceDecodeError);
    if (failure instanceof EvidenceWorkspaceDecodeError) {
      expect(failure.message).toBe(
        "Duplicate learning artifact id: artifact-1."
      );
    }
  });

  it("maps artifact invariant failures into workspace decode errors", async () => {
    const exit = await Effect.runPromiseExit(
      decodeEvidenceWorkspace({
        contributions: [
          createContributionInput({
            artifacts: [
              createArtifactInput("artifact-1", {
                duplicatePrimitiveId: true,
              }),
            ],
          }),
        ],
        createdAt: 1_782_195_600,
        turnId: "turn-1",
      })
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(EvidenceWorkspaceDecodeError);
    if (failure instanceof EvidenceWorkspaceDecodeError) {
      expect(failure.message).toBe(
        "Duplicate coordinate primitive id: point-1."
      );
    }
  });
});

function createContribution() {
  return CapabilityContribution.make({
    capability: MATH_CAPABILITY,
    evidence: EvidenceEnvelope.make({
      capability: MATH_CAPABILITY,
      refs: ["cas://math/evaluate"],
      status: "available",
      summary: "CAS verified the coordinate relation.",
    }),
    modelSummary: "CAS verified the coordinate relation.",
    pedagogyMoves: [
      PedagogyMove.make({
        evidenceRefs: ["cas://math/evaluate"],
        kind: "verification-note",
        summary: "Anchor the explanation in the verified relation.",
      }),
    ],
  });
}

function createContributionInput(input: { artifacts?: readonly unknown[] }) {
  return {
    artifacts: input.artifacts,
    capability: MATH_CAPABILITY,
    evidence: {
      capability: MATH_CAPABILITY,
      refs: ["cas://math/evaluate"],
      status: "available",
      summary: "CAS verified the coordinate relation.",
    },
    modelSummary: "CAS verified the coordinate relation.",
  };
}

function createArtifactInput(
  id: string,
  input: { duplicatePrimitiveId?: boolean } = {}
) {
  return {
    id,
    kind: "coordinate-system-3d",
    payload: {
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
        {
          id: input.duplicatePrimitiveId ? "point-1" : "point-2",
          kind: "point",
          point: point("1", "0", "0"),
        },
      ],
      sampling: {
        curveSamples: 16,
        surfaceCells: 16,
      },
    },
    proofAnchors: ["cas://coordinate/artifact"],
    title: "Coordinate artifact",
  };
}

function point(x: string, y: string, z: string) {
  return {
    x: scalar(x),
    y: scalar(y),
    z: scalar(z),
  };
}

function scalar(expression: string) {
  return {
    expression,
    latex: expression,
  };
}

/** Extracts the typed Effect failure from an Exit for workspace assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
