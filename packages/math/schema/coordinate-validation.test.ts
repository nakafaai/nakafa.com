import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  type MathVariableName,
} from "@repo/math/schema/ast";
import {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  FunctionDomain,
} from "@repo/math/schema/coordinate-primitives";
import {
  CoordinatePrimitiveInvariantError,
  findCoordinatePrimitiveIssue,
} from "@repo/math/schema/coordinate-validation";
import { describe, expect, it } from "vitest";

describe("coordinate primitive validation", () => {
  it("accepts valid scalar, curve, and surface function domains", () => {
    expect(
      findCoordinatePrimitiveIssue([
        {
          function: functionSpec("x", ["x", "z"]),
          id: "surface",
          kind: "function-surface",
        },
        {
          function: vectorFunctionSpec(["t"], {
            x: variableAst("t"),
            y: literalAst("0"),
            z: literalAst("1"),
          }),
          id: "curve",
          kind: "parametric-curve",
        },
        {
          function: vectorFunctionSpec(["u", "v"], {
            x: variableAst("u"),
            y: variableAst("v"),
            z: literalAst("0"),
          }),
          id: "surface-parametric",
          kind: "parametric-surface",
        },
      ])
    ).toBeUndefined();
  });

  it("rejects zero ray directions", () => {
    expect(
      readIssueMessage([
        {
          direction: point("0.0", "0e0", "-0"),
          id: "ray-zero",
          kind: "ray",
          origin: point("0", "0", "0"),
        },
      ])
    ).toBe("Coordinate primitive ray-zero has a zero direction vector.");
  });

  it("rejects zero line directions", () => {
    expect(
      readIssueMessage([
        {
          direction: point("0", "0", "0"),
          id: "line-zero",
          kind: "line",
          point: point("1", "0", "0"),
        },
      ])
    ).toBe("Coordinate primitive line-zero has a zero direction vector.");
  });

  it("rejects zero plane normals", () => {
    expect(
      readIssueMessage([
        {
          equation: functionSpec("z", ["z"]),
          id: "plane-zero",
          kind: "plane",
          normal: point("0", "0", "0"),
          point: point("0", "0", "0"),
        },
      ])
    ).toBe("Coordinate primitive plane-zero has a zero normal vector.");
  });

  it("rejects plane equation domain issues", () => {
    expect(
      readIssueMessage([
        {
          equation: functionSpec("z", ["x"]),
          id: "plane-domain",
          kind: "plane",
          normal: point("0", "0", "1"),
          point: point("0", "0", "0"),
        },
      ])
    ).toBe("Coordinate primitive plane-domain is missing function domain z.");
  });

  it("rejects missing function domains", () => {
    expect(
      readIssueMessage([
        {
          function: functionSpec("x", ["y", "z"]),
          id: "missing-domain",
          kind: "function-surface",
        },
      ])
    ).toBe("Coordinate primitive missing-domain is missing function domain x.");
  });

  it("allows constant functions over declared domains", () => {
    expect(
      findCoordinatePrimitiveIssue([
        {
          function: {
            ast: literalAst("0"),
            domain: [domain("x"), domain("z")],
          },
          id: "constant-surface",
          kind: "function-surface",
        },
      ])
    ).toBeUndefined();
  });

  it("rejects repeated function domains", () => {
    expect(
      readIssueMessage([
        {
          function: functionSpec("x", ["x", "x"]),
          id: "repeat-domain",
          kind: "function-surface",
        },
      ])
    ).toBe("Coordinate primitive repeat-domain repeats function domain x.");
  });

  it("rejects scalar function surface arity mismatches", () => {
    expect(
      readIssueMessage([
        {
          function: functionSpec("x", ["x"]),
          id: "scalar-surface-arity",
          kind: "function-surface",
        },
      ])
    ).toBe(
      "Coordinate primitive scalar-surface-arity must have exactly 2 function domain variables."
    );
  });

  it("rejects parametric curve arity mismatches", () => {
    expect(
      readIssueMessage([
        {
          function: vectorFunctionSpec(["t", "u"], {
            x: variableAst("t"),
            y: variableAst("u"),
            z: literalAst("0"),
          }),
          id: "curve-arity",
          kind: "parametric-curve",
        },
      ])
    ).toBe(
      "Coordinate primitive curve-arity must have exactly 1 function domain variables."
    );
  });

  it("rejects parametric surface arity mismatches", () => {
    expect(
      readIssueMessage([
        {
          function: vectorFunctionSpec(["u"], {
            x: variableAst("u"),
            y: literalAst("0"),
            z: literalAst("1"),
          }),
          id: "surface-arity",
          kind: "parametric-surface",
        },
      ])
    ).toBe(
      "Coordinate primitive surface-arity must have exactly 2 function domain variables."
    );
  });
});

function readIssueMessage(
  primitives: Parameters<typeof findCoordinatePrimitiveIssue>[0]
) {
  const issue = findCoordinatePrimitiveIssue(primitives);

  expect(issue).toBeInstanceOf(CoordinatePrimitiveInvariantError);
  return issue?.message;
}

function functionSpec(
  variable: MathVariableName,
  domains: readonly MathVariableName[]
) {
  return CanonicalFunctionSpec.make({
    ast: variableAst(variable),
    domain: domains.map(domain),
  });
}

type VectorComponentAst =
  | ReturnType<typeof variableAst>
  | ReturnType<typeof literalAst>;

function vectorFunctionSpec(
  domains: readonly ("t" | "u" | "v")[],
  components: {
    x: VectorComponentAst;
    y: VectorComponentAst;
    z: VectorComponentAst;
  }
) {
  return CanonicalVectorFunctionSpec.make({
    domain: domains.map(domain),
    ...components,
  });
}

function domain(variable: MathVariableName) {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: scalar("1"),
    min: scalar("0"),
    variable,
  });
}

function variableAst(variable: MathVariableName) {
  return MathAst.make({
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
  });
}

function literalAst(expression: string) {
  const nodeId = `literal-${expression}`;

  return MathAst.make({
    canonical: expression,
    latex: expression,
    nodes: [
      {
        id: nodeId,
        kind: "literal",
        value: scalar(expression),
      },
    ],
    root: nodeId,
  });
}

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({
    x: scalar(x),
    y: scalar(y),
    z: scalar(z),
  });
}

function scalar(expression: string) {
  return ExactScalar.make({
    expression,
    latex: expression,
  });
}
