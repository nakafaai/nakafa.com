// @vitest-environment node

import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import { PEDAGOGY_MOVE_SUMMARY_MAX_LENGTH } from "@repo/ai/nina/pedagogy/schema";
import {
  decodeEvidenceWorkspace,
  EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES,
  EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT,
  EVIDENCE_CONTRIBUTION_MODEL_SUMMARY_MAX_LENGTH,
  EVIDENCE_CONTRIBUTION_PEDAGOGY_MOVE_LIMIT,
  EVIDENCE_WORKSPACE_ARTIFACT_BYTES,
  EVIDENCE_WORKSPACE_ARTIFACT_LIMIT,
  EvidenceWorkspaceDecodeError,
} from "@repo/ai/nina/workspace/schema";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("EvidenceWorkspace invariants", () => {
  it("rejects too many artifacts in one contribution", async () => {
    const failure = await decodeFailure(
      workspace([
        contribution({
          artifacts: Array.from(
            { length: EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT + 1 },
            (_, index) => artifact(`artifact-${index}`)
          ),
        }),
      ])
    );

    expectDecodeFailure(failure, "Invalid evidence workspace contract.");
  });

  it("rejects oversized contribution artifact payloads", async () => {
    const description = "x".repeat(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES + 1);
    const failure = await decodeFailure(
      workspace([
        contribution({
          artifacts: [artifact("artifact-large", description)],
        }),
      ])
    );

    expectDecodeFailure(
      failure,
      `Contribution math artifact payload exceeds ${EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES} bytes.`
    );
  });

  it("rejects aggregate workspace artifact count and byte budgets", async () => {
    const tooMany = await decodeFailure(
      workspace([
        contribution({ artifacts: artifactRange(0, 3) }),
        contribution({ artifacts: artifactRange(3, 3) }),
        contribution({ artifacts: artifactRange(6, 3) }),
      ])
    );

    expectDecodeFailure(
      tooMany,
      `Evidence workspace artifact count exceeds ${EVIDENCE_WORKSPACE_ARTIFACT_LIMIT}.`
    );

    const description = "x".repeat(
      Math.floor(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES / 2) - 50_000
    );
    const tooLarge = await decodeFailure(
      workspace([
        contribution({ artifacts: artifactRange(0, 2, description) }),
        contribution({ artifacts: artifactRange(2, 2, description) }),
        contribution({ artifacts: artifactRange(4, 2, description) }),
      ])
    );

    expectDecodeFailure(
      tooLarge,
      `Evidence workspace artifact payload exceeds ${EVIDENCE_WORKSPACE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("bounds model-visible contribution and pedagogy text", async () => {
    const longSummary = await decodeFailure(
      workspace([
        contribution({
          modelSummary: "x".repeat(
            EVIDENCE_CONTRIBUTION_MODEL_SUMMARY_MAX_LENGTH + 1
          ),
        }),
      ])
    );

    expectDecodeFailure(longSummary, "Invalid evidence workspace contract.");

    const tooManyMoves = await decodeFailure(
      workspace([
        contribution({
          pedagogyMoves: Array.from(
            { length: EVIDENCE_CONTRIBUTION_PEDAGOGY_MOVE_LIMIT + 1 },
            () => pedagogyMove("cas://math/evaluate")
          ),
        }),
      ])
    );

    expectDecodeFailure(tooManyMoves, "Invalid evidence workspace contract.");

    const longMoveSummary = await decodeFailure(
      workspace([
        contribution({
          pedagogyMoves: [
            {
              ...pedagogyMove("cas://math/evaluate"),
              summary: "x".repeat(PEDAGOGY_MOVE_SUMMARY_MAX_LENGTH + 1),
            },
          ],
        }),
      ])
    );

    expectDecodeFailure(
      longMoveSummary,
      "Invalid evidence workspace contract."
    );
  });

  it("validates pedagogy evidence refs against contribution refs and artifacts", async () => {
    const ungrounded = await decodeFailure(
      workspace([
        contribution({
          pedagogyMoves: [pedagogyMove("missing-ref")],
        }),
      ])
    );

    expectDecodeFailure(
      ungrounded,
      "Pedagogy move verification-note references unknown evidence missing-ref."
    );

    const decoded = await Effect.runPromise(
      decodeEvidenceWorkspace(
        workspace([
          contribution({
            artifacts: [artifact("artifact-1")],
            pedagogyMoves: [pedagogyMove("artifact-1")],
          }),
        ])
      )
    );

    expect(decoded.contributions[0]?.pedagogyMoves?.[0]?.evidenceRefs).toEqual([
      "artifact-1",
    ]);
  });

  it("allows pedagogy refs grounded only by artifact ids", async () => {
    const decoded = await Effect.runPromise(
      decodeEvidenceWorkspace(
        workspace([
          contributionWithoutEvidenceRefs({
            artifacts: [artifact("artifact-only")],
            pedagogyMoves: [pedagogyMove("artifact-only")],
          }),
        ])
      )
    );

    expect(decoded.contributions[0]?.evidence.refs).toBeUndefined();
  });
});

function workspace(contributions: readonly unknown[]) {
  return {
    contributions,
    createdAt: 1_782_195_600,
    turnId: "turn-1",
  };
}

function contribution(
  input: {
    artifacts?: readonly unknown[];
    modelSummary?: string;
    pedagogyMoves?: readonly unknown[];
  } = {}
) {
  return {
    artifacts: input.artifacts,
    capability: MATH_CAPABILITY,
    evidence: {
      capability: MATH_CAPABILITY,
      refs: ["cas://math/evaluate"],
      status: "available",
      summary: "CAS verified the coordinate relation.",
    },
    modelSummary: input.modelSummary ?? "CAS verified the coordinate relation.",
    pedagogyMoves: input.pedagogyMoves,
  };
}

function contributionWithoutEvidenceRefs(input: {
  artifacts: readonly unknown[];
  pedagogyMoves: readonly unknown[];
}) {
  return {
    artifacts: input.artifacts,
    capability: MATH_CAPABILITY,
    evidence: {
      capability: MATH_CAPABILITY,
      status: "available",
      summary: "CAS verified the coordinate relation.",
    },
    modelSummary: "CAS verified the coordinate relation.",
    pedagogyMoves: input.pedagogyMoves,
  };
}

function artifactRange(start: number, count: number, description?: string) {
  return Array.from({ length: count }, (_, index) =>
    artifact(`artifact-${start + index}`, description)
  );
}

function artifact(id: string, description?: string) {
  return {
    description,
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

function pedagogyMove(evidenceRef: string) {
  return {
    evidenceRefs: [evidenceRef],
    kind: "verification-note",
    summary: "Anchor the explanation in verified evidence.",
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

async function decodeFailure(input: unknown) {
  const exit = await Effect.runPromiseExit(decodeEvidenceWorkspace(input));
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}

function expectDecodeFailure(error: unknown, message: string) {
  expect(error).toBeInstanceOf(EvidenceWorkspaceDecodeError);
  if (error instanceof EvidenceWorkspaceDecodeError) {
    expect(error.message).toBe(message);
  }
}
