import {
  MAX_COORDINATE_ARTIFACT_BYTES,
  MAX_COORDINATE_ARTIFACT_PRIMITIVES,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH,
  MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS,
  MAX_LEARNING_ARTIFACT_ID_LENGTH,
} from "@repo/math/schema/artifact/safety";
import {
  CoordinateSystemArtifact,
  decodeLearningArtifact,
  LearningArtifactDecodeError,
} from "@repo/math/schema/artifact/schema";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningArtifactSchema", () => {
  it("decodes a coordinate artifact without point-cloud payloads", async () => {
    const artifact = await Effect.runPromise(
      decodeLearningArtifact(createCoordinateArtifact())
    );

    expect(artifact).toBeInstanceOf(CoordinateSystemArtifact);
    expect(artifact.kind).toBe("coordinate-system-3d");
    expect(JSON.stringify(artifact)).not.toContain("samples");
    expect(JSON.stringify(artifact)).not.toContain("points");
  });

  it("rejects invalid embedded MathAst graphs with a typed error", async () => {
    const artifact = createCoordinateArtifact({
      primitives: [
        {
          function: {
            ...functionSpec("x"),
            ast: {
              canonical: "x",
              latex: "x",
              nodes: [{ id: "x", kind: "variable", name: "x" }],
              root: "missing",
            },
          },
          id: "function-surface-1",
          kind: "function-surface",
          outputAxis: "y",
        },
      ],
    });

    const exit = await Effect.runPromiseExit(decodeLearningArtifact(artifact));
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("MathAst root node was not found: missing.");
    }
  });

  it("rejects invalid artifact schema shapes with a typed error", async () => {
    const artifact = createCoordinateArtifact({ primitives: [] });

    const exit = await Effect.runPromiseExit(decodeLearningArtifact(artifact));
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe("Invalid learning artifact contract.");
    }
  });

  it("maps raw artifact size failures into typed decode errors", async () => {
    await expectDecodeFailure(undefined, "Invalid learning artifact contract.");
    await expectDecodeFailure(
      { oversized: "x".repeat(MAX_COORDINATE_ARTIFACT_BYTES + 1) },
      `Coordinate artifact exceeds ${MAX_COORDINATE_ARTIFACT_BYTES} bytes.`
    );
  });

  it("maps artifact invariant failures into typed decode errors", async () => {
    await expectDecodeFailure(
      createCoordinateArtifact({
        axes: {
          x: [scalar("1"), scalar("0")],
          y: [scalar("-1"), scalar("1")],
          z: [scalar("-1"), scalar("1")],
        },
      }),
      "Coordinate artifact x-axis range must be increasing."
    );
  });

  it("maps primitive invariant failures into typed decode errors", async () => {
    await expectDecodeFailure(
      createCoordinateArtifact({
        primitives: [
          {
            id: "vector-zero",
            kind: "vector",
            vector: point("0", "0", "0"),
          },
        ],
      }),
      "Coordinate primitive vector-zero has a zero vector."
    );
  });

  it("enforces artifact and primitive count budgets", async () => {
    await expectDecodeFailure(
      createCoordinateArtifact({
        primitives: Array.from(
          { length: MAX_COORDINATE_ARTIFACT_PRIMITIVES + 1 },
          (_, index) => pointPrimitive(`point-${index}`, String(index))
        ),
      }),
      "Invalid learning artifact contract."
    );
  });

  it("rejects non-finite decimal hints and oversized identifiers", async () => {
    const invalidArtifacts = [
      createCoordinateArtifact({
        axes: {
          x: [scalarDecimal("1", Number.NaN), scalar("2")],
          y: [scalar("-1"), scalar("1")],
          z: [scalar("-1"), scalar("1")],
        },
      }),
      createCoordinateArtifact({ id: "   " }),
      createCoordinateArtifact({
        id: `artifact-${"x".repeat(MAX_LEARNING_ARTIFACT_ID_LENGTH)}`,
      }),
    ];

    for (const artifact of invalidArtifacts) {
      await expectDecodeFailure(
        artifact,
        "Invalid learning artifact contract."
      );
    }
  });

  it("enforces proof anchor budgets", async () => {
    await expectDecodeFailure(
      createCoordinateArtifact({
        proofAnchors: Array.from(
          { length: MAX_COORDINATE_ARTIFACT_PROOF_ANCHORS + 1 },
          (_, index) => `cas://coordinate/proof-${index}`
        ),
      }),
      "Invalid learning artifact contract."
    );
    await expectDecodeFailure(
      createCoordinateArtifact({
        proofAnchors: [
          `cas://coordinate/${"x".repeat(
            MAX_COORDINATE_ARTIFACT_PROOF_ANCHOR_LENGTH
          )}`,
        ],
      }),
      "Invalid learning artifact contract."
    );
  });
});

function createCoordinateArtifact(
  input: {
    axes?: {
      x: readonly [ReturnType<typeof scalar>, ReturnType<typeof scalar>];
      y: readonly [ReturnType<typeof scalar>, ReturnType<typeof scalar>];
      z: readonly [ReturnType<typeof scalar>, ReturnType<typeof scalar>];
    };
    id?: string;
    primitives?: readonly unknown[];
    proofAnchors?: readonly string[];
  } = {}
) {
  return {
    id: input.id ?? "artifact-coordinate-1",
    kind: "coordinate-system-3d",
    payload: {
      axes: input.axes ?? {
        x: [scalar("-5"), scalar("5")],
        y: [scalar("-5"), scalar("5")],
        z: [scalar("-5"), scalar("5")],
      },
      primitives: input.primitives ?? [pointPrimitive("point-1", "0")],
      sampling: {
        curveSamples: 64,
        surfaceCells: 32,
      },
    },
    proofAnchors: input.proofAnchors ?? ["cas://coordinate/artifact-1"],
    title: "Coordinate artifact",
  };
}

function pointPrimitive(id: string, x: string) {
  return {
    id,
    kind: "point",
    point: point(x, "0", "0"),
  };
}

function functionSpec(variable: "x") {
  return {
    ast: variableAst(variable),
    domain: [domain("x"), domain("z")],
    verifiedBy: "cas://proof/function",
  };
}

function domain(variable: "t" | "u" | "v" | "x" | "z") {
  return {
    closedMax: true,
    closedMin: true,
    max: scalar("5"),
    min: scalar("-5"),
    variable,
  };
}

function variableAst(variable: "t" | "u" | "v" | "x" | "z") {
  return {
    canonical: variable,
    latex: variable,
    nodes: [
      {
        id: variable,
        kind: "variable",
        name: variable,
      },
    ],
    root: variable,
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

function scalarDecimal(expression: string, decimal: number) {
  return {
    decimal,
    expression,
    latex: expression,
  };
}

async function expectDecodeFailure(input: unknown, message: string) {
  const exit = await Effect.runPromiseExit(decodeLearningArtifact(input));
  const failure = readExitFailure(exit);

  expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
  if (failure instanceof LearningArtifactDecodeError) {
    expect(failure.message).toBe(message);
  }
}

/** Extracts the typed Effect failure from an Exit for artifact assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
