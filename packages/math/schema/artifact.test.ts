import {
  CoordinateSystemArtifact,
  decodeLearningArtifact,
  LearningArtifactDecodeError,
} from "@repo/math/schema/artifact";
import { COORDINATE_PRIMITIVE_KIND_VALUES } from "@repo/math/schema/coordinate-primitives";
import { Cause, Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningArtifactSchema", () => {
  it("decodes the full coordinate primitive family without point clouds", async () => {
    const artifact = await Effect.runPromise(
      decodeLearningArtifact(createCoordinateArtifact())
    );

    expect(artifact).toBeInstanceOf(CoordinateSystemArtifact);
    expect(artifact.kind).toBe("coordinate-system-3d");
    expect(
      artifact.payload.primitives.map((primitive) => primitive.kind)
    ).toEqual([...COORDINATE_PRIMITIVE_KIND_VALUES]);
    expect(JSON.stringify(artifact)).not.toContain("samples");
    expect(JSON.stringify(artifact)).not.toContain("points");
  });

  it("rejects duplicate coordinate primitive ids with a typed error", async () => {
    const artifact = createCoordinateArtifact({ vectorId: "point-1" });

    const exit = await Effect.runPromiseExit(decodeLearningArtifact(artifact));
    const failure = readExitFailure(exit);

    expect(failure).toBeInstanceOf(LearningArtifactDecodeError);
    if (failure instanceof LearningArtifactDecodeError) {
      expect(failure.message).toBe(
        "Duplicate coordinate primitive id: point-1."
      );
    }
  });

  it("rejects invalid embedded MathAst graphs with a typed error", async () => {
    const artifact = createCoordinateArtifact({
      functionSurface: {
        ...functionSpec("x"),
        ast: {
          canonical: "x",
          latex: "x",
          nodes: [
            {
              id: "x",
              kind: "variable",
              name: "x",
            },
          ],
          root: "missing",
        },
      },
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
});

function createCoordinateArtifact(
  input: {
    functionSurface?: unknown;
    primitives?: readonly unknown[];
    vectorId?: string;
  } = {}
) {
  return {
    id: "artifact-coordinate-1",
    kind: "coordinate-system-3d",
    payload: {
      axes: {
        x: [scalar("-5"), scalar("5")],
        y: [scalar("-5"), scalar("5")],
        z: [scalar("-5"), scalar("5")],
      },
      primitives: input.primitives ?? [
        {
          id: "point-1",
          kind: "point",
          point: point("0", "0", "0"),
        },
        {
          id: input.vectorId ?? "vector-1",
          kind: "vector",
          vector: point("1", "0", "0"),
        },
        {
          end: point("1", "1", "0"),
          id: "segment-1",
          kind: "segment",
          start: point("0", "0", "0"),
        },
        {
          direction: point("1", "1", "0"),
          id: "ray-1",
          kind: "ray",
          origin: point("0", "0", "0"),
        },
        {
          direction: point("1", "1", "1"),
          id: "line-1",
          kind: "line",
          point: point("0", "0", "0"),
        },
        {
          equation: functionSpec("z", [literalAst("0")]),
          id: "plane-1",
          kind: "plane",
          normal: point("0", "0", "1"),
          point: point("0", "0", "0"),
        },
        {
          id: "polygon-1",
          kind: "polygon",
          vertices: [
            point("0", "0", "0"),
            point("1", "0", "0"),
            point("0", "1", "0"),
          ],
        },
        {
          id: "cuboid-1",
          kind: "cuboid",
          max: point("1", "1", "1"),
          min: point("0", "0", "0"),
        },
        {
          center: point("0", "0", "0"),
          id: "sphere-1",
          kind: "sphere",
          radius: scalar("1"),
        },
        {
          function: vectorFunctionSpec("t"),
          id: "parametric-curve-1",
          kind: "parametric-curve",
        },
        {
          function: input.functionSurface ?? functionSpec("x"),
          id: "function-surface-1",
          kind: "function-surface",
          outputAxis: "y",
        },
        {
          function: surfaceFunctionSpec(),
          id: "parametric-surface-1",
          kind: "parametric-surface",
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

function functionSpec(variable: "x" | "z", exclusions?: readonly unknown[]) {
  const domains =
    variable === "x" ? [domain("x"), domain("z")] : [domain("z"), domain("x")];

  if (exclusions) {
    return {
      ast: variableAst(variable),
      domain: domains,
      exclusions,
      verifiedBy: "cas://proof/function",
    };
  }

  return {
    ast: variableAst(variable),
    domain: domains,
    verifiedBy: "cas://proof/function",
  };
}

function vectorFunctionSpec(variable: "t" | "u") {
  return {
    domain: [domain(variable)],
    x: variableAst(variable),
    y: literalAst("0"),
    z: literalAst("1"),
  };
}

function surfaceFunctionSpec() {
  return {
    domain: [domain("u"), domain("v")],
    x: variableAst("u"),
    y: variableAst("v"),
    z: literalAst("0"),
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

function literalAst(expression: string) {
  return {
    canonical: expression,
    latex: expression,
    nodes: [
      {
        id: `literal-${expression}`,
        kind: "literal",
        value: scalar(expression),
      },
    ],
    root: `literal-${expression}`,
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

/** Extracts the typed Effect failure from an Exit for artifact assertions. */
function readExitFailure(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    return;
  }

  const failure = Cause.failureOption(exit.cause);
  return Option.isSome(failure) ? failure.value : undefined;
}
