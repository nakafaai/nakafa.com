// @vitest-environment node

import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import {
  decodeEvidenceWorkspace,
  EVIDENCE_CONTRIBUTION_LIMITATION_LIMIT,
  EVIDENCE_CONTRIBUTION_LIMITATION_MAX_LENGTH,
  EVIDENCE_CONTRIBUTION_REF_LIMIT,
  EVIDENCE_CONTRIBUTION_REF_MAX_LENGTH,
  EVIDENCE_CONTRIBUTION_SUMMARY_MAX_LENGTH,
  EvidenceWorkspaceDecodeError,
} from "@repo/ai/nina/workspace/schema";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("EvidenceWorkspace evidence contracts", () => {
  it("bounds model-visible evidence envelopes", async () => {
    const longSummary = await decodeFailure(
      workspace([
        contribution({
          evidence: evidence({
            summary: "x".repeat(EVIDENCE_CONTRIBUTION_SUMMARY_MAX_LENGTH + 1),
          }),
        }),
      ])
    );
    expectDecodeFailure(longSummary, "Invalid evidence workspace contract.");

    const tooManyLimitations = await decodeFailure(
      workspace([
        contribution({
          evidence: evidence({
            limitations: Array.from(
              { length: EVIDENCE_CONTRIBUTION_LIMITATION_LIMIT + 1 },
              (_, index) => `limitation-${index}`
            ),
          }),
        }),
      ])
    );
    expectDecodeFailure(
      tooManyLimitations,
      "Invalid evidence workspace contract."
    );

    const longLimitation = await decodeFailure(
      workspace([
        contribution({
          evidence: evidence({
            limitations: [
              "x".repeat(EVIDENCE_CONTRIBUTION_LIMITATION_MAX_LENGTH + 1),
            ],
          }),
        }),
      ])
    );
    expectDecodeFailure(longLimitation, "Invalid evidence workspace contract.");

    const tooManyRefs = await decodeFailure(
      workspace([
        contribution({
          evidence: evidence({
            refs: Array.from(
              { length: EVIDENCE_CONTRIBUTION_REF_LIMIT + 1 },
              (_, index) => `cas://math/ref-${index}`
            ),
          }),
        }),
      ])
    );
    expectDecodeFailure(tooManyRefs, "Invalid evidence workspace contract.");

    const longRef = await decodeFailure(
      workspace([
        contribution({
          evidence: evidence({
            refs: [
              `cas://math/${"x".repeat(EVIDENCE_CONTRIBUTION_REF_MAX_LENGTH)}`,
            ],
          }),
        }),
      ])
    );
    expectDecodeFailure(longRef, "Invalid evidence workspace contract.");
  });

  it("requires every pedagogy move to cite grounded evidence", async () => {
    const emptyRefs = await decodeFailure(
      workspace([
        contribution({
          pedagogyMoves: [
            {
              evidenceRefs: [],
              kind: "verification-note",
              summary: "Anchor the explanation in verified evidence.",
            },
          ],
        }),
      ])
    );

    expectDecodeFailure(emptyRefs, "Invalid evidence workspace contract.");
  });
});

function workspace(contributions: readonly unknown[]) {
  return {
    contributions,
    createdAt: 1_782_195_600,
    turnId: "turn-1",
  };
}

function contribution(input: {
  evidence?: unknown;
  pedagogyMoves?: readonly unknown[];
}) {
  return {
    capability: MATH_CAPABILITY,
    evidence: input.evidence ?? evidence(),
    modelSummary: "CAS verified the coordinate relation.",
    pedagogyMoves: input.pedagogyMoves,
  };
}

function evidence(
  input: {
    limitations?: readonly string[];
    refs?: readonly string[];
    summary?: string;
  } = {}
) {
  return {
    capability: MATH_CAPABILITY,
    refs: input.refs ?? ["cas://math/evaluate"],
    limitations: input.limitations,
    status: "available",
    summary: input.summary ?? "CAS verified the coordinate relation.",
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
