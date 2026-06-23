// @vitest-environment node

import { MATH_CAPABILITY } from "@repo/ai/nina/capability/spec";
import { findWorkspaceArtifactPreflightIssue } from "@repo/ai/nina/workspace/preflight";
import {
  decodeEvidenceWorkspace,
  EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES,
  EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT,
  EVIDENCE_WORKSPACE_ARTIFACT_BYTES,
  EVIDENCE_WORKSPACE_ARTIFACT_LIMIT,
  EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
  EvidenceWorkspaceDecodeError,
} from "@repo/ai/nina/workspace/schema";
import {
  MAX_COORDINATE_ARTIFACT_BYTES,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
} from "@repo/math/schema/artifact/safety";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

const BAD_WORKSPACE = "Invalid evidence workspace contract.";

describe("EvidenceWorkspace invariants", () => {
  it("falls through to schema errors when preflight has no artifact arrays", async () => {
    for (const input of [
      null,
      {},
      workspace([null]),
      workspace([contribution({ artifacts: [undefined] })]),
    ]) {
      await expectDecodeIssue(input);
    }
  });

  it("rejects too many artifacts in one contribution", async () => {
    const failure = await decodeFailure(
      workspace([
        contribution({
          artifacts: invalidArtifactRange(
            0,
            EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT + 1
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
    const contributions = new Array(
      EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT + 1
    ).fill(rawContribution);
    const failure = await decodeFailure(workspace(contributions));

    expect(inspected).toBe(false);
    expectDecodeFailure(failure);
  });

  it("uses checked array lengths instead of custom raw iterators", async () => {
    let iterated = false;
    const contributions = [contribution()];
    Object.defineProperty(contributions, Symbol.iterator, {
      *value() {
        iterated = true;
        yield contribution({ artifacts: [oversizedPart(10)] });
      },
    });

    await expect(
      preflightIssue(workspace(contributions))
    ).resolves.toBeUndefined();
    expect(iterated).toBe(false);

    let expanded = false;
    const mutableContributions = [contribution(), contribution()];
    const lengthMutatingContributions = new Proxy(mutableContributions, {
      get(target, property, receiver) {
        if (property === "0" && !expanded) {
          expanded = true;
          target.push(
            contribution({
              artifacts: new Array(EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT + 1),
            })
          );
        }

        return Reflect.get(target, property, receiver);
      },
    });

    await expect(
      preflightIssue(workspace(lengthMutatingContributions))
    ).resolves.toBeUndefined();
    expect(expanded).toBe(true);
  });

  it("rejects oversized contribution artifact payloads", async () => {
    const part = oversizedPart(
      Math.floor(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES / 3) + 10_000
    );
    const cases = [
      {
        message: `Contribution math artifact payload exceeds ${EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES} bytes.`,
        rawContribution: contribution({ artifacts: [part, part, part] }),
      },
      {
        message: `Contribution artifact payload exceeds ${EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES} bytes.`,
        rawContribution: { artifacts: [part, part, part] },
      },
    ];

    for (const testCase of cases) {
      expectDecodeFailure(
        await decodeFailure(workspace([testCase.rawContribution])),
        testCase.message
      );
    }
  });

  it("preflights aggregate artifact budgets before deep artifact decode", async () => {
    const tooMany = await decodeFailure(
      workspace(
        [0, 3, 6].map((start) =>
          contribution({ artifacts: invalidArtifactRange(start, 3) })
        )
      )
    );

    expectDecodeFailure(
      tooMany,
      `Evidence workspace artifact count exceeds ${EVIDENCE_WORKSPACE_ARTIFACT_LIMIT}.`
    );

    const largeInvalidArtifact = oversizedPart(
      Math.floor(EVIDENCE_WORKSPACE_ARTIFACT_BYTES / 6) + 20_000
    );
    const tooLarge = await decodeFailure(
      workspace(
        Array.from({ length: 3 }, () =>
          contribution({
            artifacts: [largeInvalidArtifact, largeInvalidArtifact],
          })
        )
      )
    );

    expectDecodeFailure(
      tooLarge,
      `Evidence workspace artifact payload exceeds ${EVIDENCE_WORKSPACE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("preflights per-artifact bytes before deep artifact decode", async () => {
    const arrayFailure = await decodeFailure(
      workspace([
        contribution({
          artifacts: [
            {
              payload: {
                primitives: new Array(MAX_COORDINATE_ARTIFACT_PRIMITIVES + 1),
              },
            },
          ],
        }),
      ])
    );
    expectDecodeFailure(
      arrayFailure,
      `Coordinate artifact primitives exceeds ${MAX_COORDINATE_ARTIFACT_PRIMITIVES} items.`
    );

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

  it("maps raw preflight read failures to typed decode failures", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    await expectDecodeIssue(workspace([contribution({ artifacts: [cyclic] })]));
    await expectDecodeIssue({ contributions: invalidLengthArray() });
    await expectDecodeIssue(throwingField("contributions"));
    await expectDecodeIssue(
      workspace([
        contribution({
          artifacts: [{ payload: { primitives: invalidLengthArray() } }],
        }),
      ])
    );

    const part = oversizedPart(
      Math.floor(EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES / 3) + 10_000
    );
    await expectDecodeIssue(workspace([throwingCapabilityContribution(part)]));
  });
});

function workspace(contributions: readonly unknown[]) {
  return { contributions, createdAt: 1_782_195_600, turnId: "turn-1" };
}

function contribution(input: { artifacts?: readonly unknown[] } = {}) {
  return {
    artifacts: input.artifacts,
    capability: MATH_CAPABILITY,
  };
}

function invalidArtifactRange(start: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `invalid-artifact-${start + index}`,
  }));
}

function oversizedPart(byteCount: number) {
  return { oversized: "x".repeat(byteCount) };
}

function limits() {
  return {
    artifactBytes: MAX_COORDINATE_ARTIFACT_BYTES,
    contributionArtifactBytes: EVIDENCE_CONTRIBUTION_ARTIFACT_BYTES,
    contributionArtifactLimit: EVIDENCE_CONTRIBUTION_ARTIFACT_LIMIT,
    contributionLimit: EVIDENCE_WORKSPACE_CONTRIBUTION_LIMIT,
    workspaceArtifactBytes: EVIDENCE_WORKSPACE_ARTIFACT_BYTES,
    workspaceArtifactLimit: EVIDENCE_WORKSPACE_ARTIFACT_LIMIT,
  };
}

function throwingField(field: string) {
  return {
    get [field]() {
      throw new Error(`${field} getter failed`);
    },
  };
}

function invalidLengthArray() {
  return new Proxy([], {
    get(target, property, receiver) {
      return property === "length"
        ? "bad"
        : Reflect.get(target, property, receiver);
    },
  });
}

function throwingCapabilityContribution(part: unknown) {
  return {
    artifacts: [part, part, part],
    get capability() {
      throw new Error("capability getter failed");
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

function preflightIssue(input: unknown) {
  return Effect.runPromise(
    findWorkspaceArtifactPreflightIssue(input, limits())
  );
}

async function expectDecodeIssue(input: unknown, message?: string) {
  expectDecodeFailure(await decodeFailure(input), message);
}

function expectDecodeFailure(error: unknown, message = BAD_WORKSPACE) {
  expect(error).toBeInstanceOf(EvidenceWorkspaceDecodeError);
  if (error instanceof EvidenceWorkspaceDecodeError) {
    expect(error.message).toBe(message);
  }
}
