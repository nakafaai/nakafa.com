import {
  ArtifactSafetyReadError,
  findRawArtifactSizeIssue,
  MAX_COORDINATE_ARTIFACT_BYTES,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS,
} from "@repo/math/schema/artifact/safety";
import { MAX_MATH_AST_NODES } from "@repo/math/schema/ast/schema";
import {
  MAX_FUNCTION_DOMAINS,
  MAX_FUNCTION_EXCLUSIONS,
  MAX_POLYGON_VERTICES,
} from "@repo/math/schema/coordinate/primitive";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("artifact raw safety preflight", () => {
  it("bounds raw serialized artifact bytes before schema traversal", async () => {
    await expectRawSizeIssue(
      { oversized: "x".repeat(MAX_COORDINATE_ARTIFACT_BYTES + 1) },
      `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("checks raw primitive arrays before JSON serialization", async () => {
    await expectRawSizeIssue(
      {
        payload: {
          primitives: new Array(MAX_COORDINATE_ARTIFACT_PRIMITIVES + 1),
        },
      },
      `Coordinate artifact primitives exceeds ${MAX_COORDINATE_ARTIFACT_PRIMITIVES} items.`
    );
  });

  it("checks raw proof anchor arrays before JSON serialization", async () => {
    await expectRawSizeIssue(
      {
        proofAnchors: new Array(MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS + 1),
      },
      `Coordinate artifact proof anchors exceeds ${MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS} items.`
    );
  });

  it("checks raw primitive geometry arrays before JSON serialization", async () => {
    await expectRawSizeIssue(
      {
        payload: {
          primitives: [
            {
              vertices: new Array(MAX_POLYGON_VERTICES + 1),
            },
          ],
        },
      },
      `Coordinate primitive 0 polygon vertices exceeds ${MAX_POLYGON_VERTICES} items.`
    );
  });

  it("checks raw MathAst arrays before JSON serialization", async () => {
    await expectRawSizeIssue(
      {
        payload: {
          primitives: [
            {
              function: {
                ast: { nodes: new Array(MAX_MATH_AST_NODES + 1) },
              },
            },
          ],
        },
      },
      `Coordinate primitive 0 function ast nodes exceeds ${MAX_MATH_AST_NODES} items.`
    );
  });

  it("checks raw function arrays before JSON serialization", async () => {
    const cases = [
      {
        input: {
          function: { domain: new Array(MAX_FUNCTION_DOMAINS + 1) },
        },
        message: `Coordinate primitive 0 function domains exceeds ${MAX_FUNCTION_DOMAINS} items.`,
      },
      {
        input: {
          function: { exclusions: new Array(MAX_FUNCTION_EXCLUSIONS + 1) },
        },
        message: `Coordinate primitive 0 function exclusions exceeds ${MAX_FUNCTION_EXCLUSIONS} items.`,
      },
      {
        input: {
          function: { x: { nodes: new Array(MAX_MATH_AST_NODES + 1) } },
        },
        message: `Coordinate primitive 0 function x nodes exceeds ${MAX_MATH_AST_NODES} items.`,
      },
      {
        input: {
          function: {
            exclusions: [{ nodes: new Array(MAX_MATH_AST_NODES + 1) }],
          },
        },
        message: `Coordinate primitive 0 function exclusion 0 nodes exceeds ${MAX_MATH_AST_NODES} items.`,
      },
      {
        input: {
          equation: { domain: new Array(MAX_FUNCTION_DOMAINS + 1) },
        },
        message: `Coordinate primitive 0 equation domains exceeds ${MAX_FUNCTION_DOMAINS} items.`,
      },
    ];

    for (const testCase of cases) {
      await expectRawSizeIssue(
        { payload: { primitives: [testCase.input] } },
        testCase.message
      );
    }
  });

  it("allows bounded raw exclusion arrays before serialized size checks", async () => {
    const issue = await Effect.runPromise(
      findRawArtifactSizeIssue({
        payload: {
          primitives: [
            {
              function: {
                exclusions: [{}],
              },
            },
          ],
        },
      })
    );

    expect(issue).toBeUndefined();
  });

  it("maps throwing raw property reads into the typed preflight failure", async () => {
    const raw = {
      get proofAnchors() {
        return JSON.parse("{");
      },
    };

    const exit = await Effect.runPromiseExit(findRawArtifactSizeIssue(raw));
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(ArtifactSafetyReadError);
    if (failure instanceof ArtifactSafetyReadError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("maps unserializable raw artifacts into the typed preflight failure", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    const exit = await Effect.runPromiseExit(findRawArtifactSizeIssue(cyclic));
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(ArtifactSafetyReadError);
    if (failure instanceof ArtifactSafetyReadError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("rejects raw values that cannot produce JSON", async () => {
    const exit = await Effect.runPromiseExit(
      findRawArtifactSizeIssue(undefined)
    );
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(ArtifactSafetyReadError);
    if (failure instanceof ArtifactSafetyReadError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });
});

async function expectRawSizeIssue(input: unknown, message: string) {
  const issue = await Effect.runPromise(findRawArtifactSizeIssue(input));
  expect(issue).toBe(message);
}

function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
