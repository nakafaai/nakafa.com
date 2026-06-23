// @vitest-environment node

import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import {
  decodeEvidenceWorkspace,
  EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES,
  EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT,
  EVIDENCE_WORKSPACE_ARTIFACT_BYTES,
  EVIDENCE_WORKSPACE_ARTIFACT_LIMIT,
  EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
  EvidenceWorkspaceDecodeError,
} from "@repo/ai/nina/workspace/schema";
import { MAX_COORDINATE_ARTIFACT_BYTES } from "@repo/math/schema/artifact/safety";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

const BAD_WORKSPACE = "Invalid evidence workspace contract.";

describe("EvidenceWorkspace invariants", () => {
  it("falls through to schema errors when preflight has no artifact arrays", async () => {
    const invalidInputs = [
      null,
      {},
      workspace([null]),
      workspace([contribution({ artifacts: [undefined] })]),
    ];

    for (const input of invalidInputs) {
      expectDecodeFailure(await decodeFailure(input));
    }
  });

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

  it("rejects oversized contribution arrays before walking raw rows", async () => {
    let inspected = false;
    const rawContribution = {
      get artifacts() {
        inspected = true;
        return [];
      },
    };
    const overLimitLength = EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT + 1;
    const failure = await decodeFailure(
      workspace(Array.from({ length: overLimitLength }, () => rawContribution))
    );

    expect(inspected).toBe(false);
    expectDecodeFailure(failure);
  });

  it("rejects oversized contribution artifact payloads", async () => {
    const description = "x".repeat(
      Math.floor(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES / 3) + 10_000
    );
    const failure = await decodeFailure(
      workspace([
        contribution({
          artifacts: artifactRange(0, 3, description),
        }),
      ])
    );

    expectDecodeFailure(
      failure,
      `Contribution math artifact payload exceeds ${EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES} bytes.`
    );
  });

  it("preflights aggregate artifact budgets before deep artifact decode", async () => {
    const tooMany = await decodeFailure(
      workspace([
        contribution({ artifacts: invalidArtifactRange(0, 3) }),
        contribution({ artifacts: invalidArtifactRange(3, 3) }),
        contribution({ artifacts: invalidArtifactRange(6, 3) }),
      ])
    );

    expectDecodeFailure(
      tooMany,
      `Evidence workspace artifact count exceeds ${EVIDENCE_WORKSPACE_ARTIFACT_LIMIT}.`
    );

    const largeInvalidArtifact = oversizedPart(
      Math.floor(EVIDENCE_WORKSPACE_ARTIFACT_BYTES / 6) + 20_000
    );
    const tooLarge = await decodeFailure(
      workspace([
        contribution({
          artifacts: [largeInvalidArtifact, largeInvalidArtifact],
        }),
        contribution({
          artifacts: [largeInvalidArtifact, largeInvalidArtifact],
        }),
        contribution({
          artifacts: [largeInvalidArtifact, largeInvalidArtifact],
        }),
      ])
    );

    expectDecodeFailure(
      tooLarge,
      `Evidence workspace artifact payload exceeds ${EVIDENCE_WORKSPACE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("preflights oversized contribution artifacts without capability metadata", async () => {
    const part = oversizedPart(
      Math.floor(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES / 3) + 10_000
    );
    const failure = await decodeFailure(
      workspace([
        {
          artifacts: [part, part, part],
        },
      ])
    );

    expectDecodeFailure(
      failure,
      `Contribution artifact payload exceeds ${EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES} bytes.`
    );
  });

  it("preflights per-artifact bytes before deep artifact decode", async () => {
    const failure = await decodeFailure(
      workspace([
        contribution({
          artifacts: [oversizedPart(MAX_COORDINATE_ARTIFACT_BYTES + 1)],
        }),
      ])
    );

    expectDecodeFailure(
      failure,
      `Evidence workspace artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("maps raw artifact serialization preflight failures", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    const failure = await decodeFailure(
      workspace([contribution({ artifacts: [cyclic] })])
    );

    expectDecodeFailure(failure, "Invalid evidence workspace contract.");
  });

  it("maps throwing raw preflight getters to typed decode failures", async () => {
    expectDecodeFailure(await decodeFailure(throwingField("contributions")));
    expectDecodeFailure(
      await decodeFailure(workspace([throwingField("artifacts")]))
    );

    const part = oversizedPart(
      Math.floor(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES / 3) + 10_000
    );
    expectDecodeFailure(
      await decodeFailure(
        workspace([
          {
            artifacts: [part, part, part],
            get capability() {
              throw new Error("capability getter failed");
            },
          },
        ])
      )
    );
  });
});

function workspace(
  contributions: readonly unknown[],
  input: { turnId?: string } = {}
) {
  return {
    contributions,
    createdAt: 1_782_195_600,
    turnId: input.turnId ?? "turn-1",
  };
}

function contribution(input: { artifacts?: readonly unknown[] } = {}) {
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

function artifactRange(start: number, count: number, description?: string) {
  return Array.from({ length: count }, (_, index) =>
    artifact(`artifact-${start + index}`, description)
  );
}

function invalidArtifactRange(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `invalid-artifact-${start + index}`,
  }));
}

function oversizedPart(byteCount: number) {
  return { oversized: "x".repeat(byteCount) };
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

function point(x: string, y: string, z: string) {
  return { x: scalar(x), y: scalar(y), z: scalar(z) };
}

function scalar(expression: string) {
  return { expression, latex: expression };
}

function throwingField(field: string) {
  return {
    get [field]() {
      throw new Error(`${field} getter failed`);
    },
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

function expectDecodeFailure(error: unknown, message = BAD_WORKSPACE) {
  expect(error).toBeInstanceOf(EvidenceWorkspaceDecodeError);
  if (error instanceof EvidenceWorkspaceDecodeError) {
    expect(error.message).toBe(message);
  }
}
