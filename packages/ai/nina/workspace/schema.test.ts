// @vitest-environment node

import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import {
  PEDAGOGY_MOVE_SUMMARY_MAX_LENGTH,
  PedagogyMove,
} from "@repo/ai/nina/pedagogy/schema";
import {
  appendCapabilityContribution,
  CapabilityContribution,
  createEvidenceWorkspace,
  decodeEvidenceWorkspace,
  EVIDENCE_CONTRIBUTION_MODEL_SUMMARY_MAX_LENGTH,
  EVIDENCE_CONTRIBUTION_PEDAGOGY_MOVE_LIMIT,
  EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
  EVIDENCE_WORKSPACE_TURN_ID_MAX_LENGTH,
  EvidenceWorkspace,
  EvidenceWorkspaceDecodeError,
  EvidenceWorkspaceLimitExceeded,
  WorkspaceEvidenceEnvelope,
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

  it("maps workspace invariant failures into workspace decode errors", async () => {
    const exit = await Effect.runPromiseExit(
      decodeEvidenceWorkspace({
        contributions: [
          createContributionInput({
            evidenceCapability: "nakafa",
          }),
        ],
        createdAt: 1_782_195_600,
        turnId: "turn-1",
      })
    );

    expectWorkspaceFailure(
      exit,
      "Contribution capability math does not match evidence capability nakafa."
    );
  });

  it("bounds workspace and contribution model-visible fields", async () => {
    const cases = [
      { turnId: "   " },
      { turnId: "t".repeat(EVIDENCE_WORKSPACE_TURN_ID_MAX_LENGTH + 1) },
      {
        contributions: [
          createContributionInput({
            modelSummary: "x".repeat(
              EVIDENCE_CONTRIBUTION_MODEL_SUMMARY_MAX_LENGTH + 1
            ),
          }),
        ],
      },
      {
        contributions: [
          createContributionInput({
            pedagogyMoves: Array.from(
              { length: EVIDENCE_CONTRIBUTION_PEDAGOGY_MOVE_LIMIT + 1 },
              () => createPedagogyMove("cas://math/evaluate")
            ),
          }),
        ],
      },
      {
        contributions: [
          createContributionInput({
            pedagogyMoves: [
              {
                ...createPedagogyMove("cas://math/evaluate"),
                summary: "x".repeat(PEDAGOGY_MOVE_SUMMARY_MAX_LENGTH + 1),
              },
            ],
          }),
        ],
      },
    ];

    for (const testCase of cases) {
      const exit = await Effect.runPromiseExit(
        decodeEvidenceWorkspace({
          contributions: testCase.contributions ?? [],
          createdAt: 1_782_195_600,
          turnId: testCase.turnId ?? "turn-1",
        })
      );
      expectWorkspaceFailure(exit, "Invalid evidence workspace contract.");
    }
  });
});

function createContribution() {
  return CapabilityContribution.make({
    capability: MATH_CAPABILITY,
    evidence: WorkspaceEvidenceEnvelope.make({
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

function createContributionInput(
  input: {
    artifacts?: readonly unknown[];
    evidenceCapability?: string;
    modelSummary?: string;
    pedagogyMoves?: readonly unknown[];
  } = {}
) {
  return {
    artifacts: input.artifacts,
    capability: MATH_CAPABILITY,
    evidence: {
      capability: input.evidenceCapability ?? MATH_CAPABILITY,
      refs: ["cas://math/evaluate"],
      status: "available",
      summary: "CAS verified the coordinate relation.",
    },
    modelSummary: input.modelSummary ?? "CAS verified the coordinate relation.",
    pedagogyMoves: input.pedagogyMoves,
  };
}

function createPedagogyMove(evidenceRef: string) {
  return {
    evidenceRefs: [evidenceRef],
    kind: "verification-note",
    summary: "Anchor the explanation in verified evidence.",
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

function expectWorkspaceFailure(
  exit: Exit.Exit<unknown, unknown>,
  message: string
) {
  const failure = readExitFailure(exit);

  expect(failure).toBeInstanceOf(EvidenceWorkspaceDecodeError);
  if (failure instanceof EvidenceWorkspaceDecodeError) {
    expect(failure.message).toBe(message);
  }
}

/** Extracts the typed Effect failure from an Exit for workspace assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
