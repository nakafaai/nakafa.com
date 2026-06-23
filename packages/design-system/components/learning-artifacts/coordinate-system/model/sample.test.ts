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
  readParametricCurveLines,
  readParametricSurfaceLines,
} from "./sample";

describe("coordinate-system/model/sample", () => {
  it("samples a vector-valued curve inside the declared render budget", () => {
    const lines = readParametricCurveLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1")],
        x: variable("t"),
        y: literal("0"),
        z: literal("1"),
      }),
      sampling(3, 2)
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.map((point) => point.toArray())).toEqual([
      [0, 0, 1],
      [0.5, 0, 1],
      [1, 0, 1],
    ]);
  });

  it("clamps curve sampling and skips invalid vector samples", () => {
    const lines = readParametricCurveLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1")],
        x: variable("t"),
        y: variable("u"),
        z: literal("0"),
      }),
      sampling(512, 2)
    );
    const clampedLines = readParametricCurveLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1")],
        x: variable("t"),
        y: literal("0"),
        z: literal("0"),
      }),
      sampling(512, 2)
    );

    expect(lines).toEqual([]);
    expect(clampedLines).toHaveLength(1);
    expect(clampedLines[0]).toHaveLength(160);
  });

  it("splits curve lines at invalid samples and skips open endpoints", () => {
    const splitLines = readParametricCurveLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "-1", "1")],
        x: variable("t"),
        y: divide(literal("1"), variable("t")),
        z: literal("0"),
      }),
      sampling(5, 2)
    );
    const openLines = readParametricCurveLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("t", "0", "1", false, false)],
        x: variable("t"),
        y: literal("0"),
        z: literal("0"),
      }),
      sampling(5, 2)
    );

    expect(splitLines.map((line) => line.map((point) => point.x))).toEqual([
      [-1, -0.5],
      [0.5, 1],
    ]);
    expect(openLines[0]?.map((point) => point.x)).toEqual([0.25, 0.5, 0.75]);
  });

  it("samples scalar function surfaces by output axis", () => {
    const lines = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
      }),
      "y",
      sampling(2, 2)
    );

    expect(lines).toHaveLength(6);
    expect(lines[0]?.map((point) => point.toArray())).toEqual([
      [0, 0, 0],
      [0, 0, 0.5],
      [0, 0, 1],
    ]);
  });

  it("applies scalar function surface exclusions while sampling", () => {
    const lines = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
        exclusions: [variable("x")],
      }),
      "y",
      sampling(2, 2)
    );

    expect(lines.flat().some((point) => point.x === 0)).toBe(false);
  });

  it("drops scalar surface rows with missing domains or invalid samples", () => {
    const policy = sampling(2, 2);
    const missingDomain = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1")],
      }),
      "y",
      policy
    );
    const missingOutput = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("u"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
      }),
      "y",
      policy
    );
    const missingCoordinate = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "0", "1"), domain("z", "0", "1")],
      }),
      "x",
      policy
    );
    const invalidInterval = readFunctionSurfaceLines(
      CanonicalFunctionSpec.make({
        ast: variable("x"),
        domain: [domain("x", "1", "1"), domain("z", "0", "1")],
      }),
      "y",
      policy
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
      sampling(2, 2)
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
      sampling(2, 2)
    );
    const clampedLines = readParametricSurfaceLines(
      CanonicalVectorFunctionSpec.make({
        domain: [domain("u", "0", "1"), domain("v", "0", "1")],
        x: variable("u"),
        y: variable("v"),
        z: literal("0"),
      }),
      sampling(2, 512)
    );

    expect(missingDomain).toEqual([]);
    expect(clampedLines).toHaveLength(66);
  });
});

/** Builds a schema-owned sampling policy for deterministic renderer tests. */
function sampling(curveSamples: number, surfaceCells: number) {
  return RenderSamplingPolicy.make({ curveSamples, surfaceCells });
}

/** Builds a schema-owned function domain for sampling tests. */
function domain(
  variableName: "t" | "u" | "v" | "x" | "z",
  min: string,
  max: string,
  closedMin = true,
  closedMax = true
) {
  return FunctionDomain.make({
    closedMax,
    closedMin,
    max: scalar(max),
    min: scalar(min),
    variable: variableName,
  });
}

/** Builds a binary division MathAst used by discontinuity sampling tests. */
function divide(left: MathAst, right: MathAst) {
  return MathAst.make({
    canonical: `${left.canonical}/${right.canonical}`,
    latex: `${left.latex}/${right.latex}`,
    nodes: [
      ...left.nodes.map((node) => ({ ...node, id: `left-${node.id}` })),
      ...right.nodes.map((node) => ({ ...node, id: `right-${node.id}` })),
      {
        id: "root",
        kind: "binary",
        left: `left-${left.root}`,
        operator: "divide",
        right: `right-${right.root}`,
      },
    ],
    root: "root",
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
