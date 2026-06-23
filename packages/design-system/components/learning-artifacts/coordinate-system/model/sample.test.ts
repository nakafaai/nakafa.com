import { ExactScalar, MathAst } from "@repo/math/schema/ast/schema";
import {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  FunctionDomain,
  RenderSamplingPolicy,
} from "@repo/math/schema/coordinate/primitive";
import { describe, expect, it } from "vitest";
import {
  readFunctionSurfaceLines,
  readParametricCurvePoints,
  readParametricSurfaceLines,
} from "./sample";

describe("coordinate-system/model/sample", () => {
  it("samples a vector-valued curve inside the declared render budget", () => {
    const points = readParametricCurvePoints(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1")],
        x: variable("t"),
        y: literal("0"),
        z: literal("1"),
      }),
      RenderSamplingPolicy.make({
        curveSamples: 3,
        surfaceCells: 2,
      })
    );

    expect(points.map((point) => point.toArray())).toEqual([
      [0, 0, 1],
      [0.5, 0, 1],
      [1, 0, 1],
    ]);
  });

  it("clamps curve sampling and skips invalid vector samples", () => {
    const points = readParametricCurvePoints(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1")],
        x: variable("t"),
        y: variable("u"),
        z: literal("0"),
      }),
      RenderSamplingPolicy.make({
        curveSamples: 512,
        surfaceCells: 2,
      })
    );
    const clampedPoints = readParametricCurvePoints(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1")],
        x: variable("t"),
        y: literal("0"),
        z: literal("0"),
      }),
      RenderSamplingPolicy.make({
        curveSamples: 512,
        surfaceCells: 2,
      })
    );

    expect(points).toEqual([]);
    expect(clampedPoints).toHaveLength(160);
  });

  it("samples scalar function surfaces by output axis", () => {
    const lines = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
      }),
      "y",
      RenderSamplingPolicy.make({
        curveSamples: 2,
        surfaceCells: 2,
      })
    );

    expect(lines).toHaveLength(6);
    expect(lines[0]?.map((point) => point.toArray())).toEqual([
      [0, 0, 0],
      [0, 0, 0.5],
      [0, 0, 1],
    ]);
  });

  it("drops scalar surface rows with missing domains or invalid samples", () => {
    const sampling = RenderSamplingPolicy.make({
      curveSamples: 2,
      surfaceCells: 2,
    });
    const missingDomain = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1")],
      }),
      "y",
      sampling
    );
    const missingOutput = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("u"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
      }),
      "y",
      sampling
    );
    const missingCoordinate = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
      }),
      "x",
      sampling
    );
    const invalidInterval = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "1", "1"), domain("z", "0", "1")],
      }),
      "y",
      sampling
    );

    expect(missingDomain).toEqual([]);
    expect(missingOutput).toEqual([]);
    expect(missingCoordinate).toEqual([]);
    expect(invalidInterval).toEqual([]);
  });

  it("samples vector-valued surfaces in both parameter directions", () => {
    const lines = readParametricSurfaceLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("u", "0", "1"), domain("v", "0", "1")],
        x: variable("u"),
        y: variable("v"),
        z: literal("0"),
      }),
      RenderSamplingPolicy.make({
        curveSamples: 2,
        surfaceCells: 2,
      })
    );

    expect(lines).toHaveLength(6);
    expect(lines[0]?.map((point) => point.toArray())).toEqual([
      [0, 0, 0],
      [0, 0.5, 0],
      [0, 1, 0],
    ]);
    expect(lines.at(-1)?.map((point) => point.toArray())).toEqual([
      [0, 1, 0],
      [0.5, 1, 0],
      [1, 1, 0],
    ]);
  });

  it("clamps surface sampling and returns no rows without two domains", () => {
    const missingDomain = readParametricSurfaceLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("u", "0", "1")],
        x: variable("u"),
        y: variable("v"),
        z: literal("0"),
      }),
      RenderSamplingPolicy.make({
        curveSamples: 2,
        surfaceCells: 2,
      })
    );
    const clampedLines = readParametricSurfaceLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("u", "0", "1"), domain("v", "0", "1")],
        x: variable("u"),
        y: variable("v"),
        z: literal("0"),
      }),
      RenderSamplingPolicy.make({
        curveSamples: 2,
        surfaceCells: 512,
      })
    );

    expect(missingDomain).toEqual([]);
    expect(clampedLines).toHaveLength(66);
  });
});

/** Builds a schema-owned function domain for sampling tests. */
function domain(
  variableName: "t" | "u" | "v" | "x" | "z",
  min: string,
  max: string
) {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: scalar(max),
    min: scalar(min),
    variable: variableName,
  });
}

/** Builds a literal scalar MathAst used by deterministic model sampling. */
function literal(expression: string) {
  return MathAst.make({
    canonical: expression,
    latex: expression,
    nodes: [
      {
        id: "root",
        kind: "literal",
        value: scalar(expression),
      },
    ],
    root: "root",
  });
}

/** Builds a single-variable MathAst used by deterministic model sampling. */
function variable(name: "t" | "u" | "v" | "x" | "z") {
  return MathAst.make({
    canonical: name,
    latex: name,
    nodes: [
      {
        id: "root",
        kind: "variable",
        name,
      },
    ],
    root: "root",
  });
}

/** Builds a schema-owned exact scalar fixture for sampling tests. */
function scalar(expression: string) {
  return ExactScalar.make({
    decimal: Number(expression),
    expression,
    latex: expression,
  });
}
