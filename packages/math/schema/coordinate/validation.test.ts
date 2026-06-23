import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  type MathVariableName,
} from "@repo/math/schema/ast/schema";
import {
  CanonicalFunctionSpec,
  CanonicalVectorFunctionSpec,
  type CoordinatePrimitive,
  FunctionDomain,
} from "@repo/math/schema/coordinate/primitive";
import {
  CoordinatePrimitiveInvariantError,
  findCoordinatePrimitiveIssue,
} from "@repo/math/schema/coordinate/validation";
import { describe, expect, it } from "vitest";

type PlanePrimitive = Extract<CoordinatePrimitive, { kind: "plane" }>;

describe("coordinate primitive validation", () => {
  it("accepts valid primitive geometry and function contracts", () => {
    const primitives: CoordinatePrimitive[] = [
      surface("surface", functionSpec("x", ["x", "z"], [literalAst("1")])),
      surface("constant-surface", functionSpecAst(literalAst("0"), ["x", "z"])),
      vector("vector", "1"),
      ray("ray", "1"),
      line("line", "1"),
      plane("plane", "0"),
      curve("curve", ["t"], {
        x: variableAst("t"),
        y: literalAst("0"),
        z: literalAst("1"),
      }),
      parametricSurface("surface-parametric", ["u", "v"], {
        x: variableAst("u"),
        y: variableAst("v"),
        z: literalAst("0"),
      }),
    ];

    expect(findCoordinatePrimitiveIssue(primitives)).toBeUndefined();
  });

  it("rejects invalid primitive geometry and scalar function contracts", () => {
    const cases: [CoordinatePrimitive, string][] = [
      [
        ray("ray-zero", "0"),
        "Coordinate primitive ray-zero has a zero direction vector.",
      ],
      [
        line("line-zero", "0"),
        "Coordinate primitive line-zero has a zero direction vector.",
      ],
      [
        vector("vector-zero", "0"),
        "Coordinate primitive vector-zero has a zero vector.",
      ],
      [
        {
          ...plane("plane-zero", "0"),
          normal: point("0", "0", "0"),
        },
        "Coordinate primitive plane-zero has a zero normal vector.",
      ],
      [
        sphere("sphere-symbolic", "r"),
        "Coordinate primitive sphere-symbolic sphere radius must use a sortable numeric value.",
      ],
      [
        {
          ...plane("plane-domain", "0"),
          equation: functionSpec("z", ["x"]),
        },
        "Coordinate primitive plane-domain is missing function domain z.",
      ],
      [
        plane("plane-inconsistent", "1"),
        "Coordinate primitive plane-inconsistent plane equation is inconsistent with point and normal.",
      ],
      [
        surface("missing-domain", functionSpec("x", ["y", "z"]), "x"),
        "Coordinate primitive missing-domain is missing function domain x.",
      ],
      [
        surface("output-domain", functionSpec("x", ["x", "y"])),
        "Coordinate primitive output-domain function surface output axis y must not be a domain variable.",
      ],
      [
        surface("repeat-domain", functionSpec("x", ["x", "x"])),
        "Coordinate primitive repeat-domain repeats function domain x.",
      ],
      [
        surface("bad-domain", functionSpecWithDomain(domain("x", "left", "1"))),
        "Coordinate primitive bad-domain domain x must use sortable numeric bounds.",
      ],
      [
        surface(
          "bad-max-domain",
          functionSpecWithDomain(domain("x", "0", "right"))
        ),
        "Coordinate primitive bad-max-domain domain x must use sortable numeric bounds.",
      ],
      [
        surface(
          "inverted-domain",
          functionSpecWithDomain(domain("x", "2", "1"))
        ),
        "Coordinate primitive inverted-domain domain x must be increasing.",
      ],
    ];

    for (const [primitive, message] of cases) {
      expectIssue([primitive], message);
    }
  });

  it("rejects parametric vector function arity mismatches", () => {
    expectIssue(
      [
        curve("curve-arity", ["t", "u"], {
          x: variableAst("t"),
          y: variableAst("u"),
          z: literalAst("0"),
        }),
      ],
      "Coordinate primitive curve-arity must have exactly 1 function domain variables."
    );
    expectIssue(
      [parametricSurface("surface-arity", ["u"])],
      "Coordinate primitive surface-arity must have exactly 2 function domain variables."
    );
  });
});

function expectIssue(
  primitives: Parameters<typeof findCoordinatePrimitiveIssue>[0],
  message: string
) {
  const issue = findCoordinatePrimitiveIssue(primitives);
  expect(issue).toBeInstanceOf(CoordinatePrimitiveInvariantError);
  expect(issue?.message).toBe(message);
}

function surface(
  id: string,
  functionSpec: CanonicalFunctionSpec,
  outputAxis: "x" | "y" | "z" = "y"
): CoordinatePrimitive {
  return { function: functionSpec, id, kind: "function-surface", outputAxis };
}

function vector(id: string, x: string): CoordinatePrimitive {
  return { id, kind: "vector", vector: point(x, "0", "0") };
}

function ray(id: string, x: string): CoordinatePrimitive {
  return {
    direction: point(x, "0", "0"),
    id,
    kind: "ray",
    origin: point("0", "0", "0"),
  };
}

function line(id: string, x: string): CoordinatePrimitive {
  return {
    direction: point(x, "0", "0"),
    id,
    kind: "line",
    point: point("0", "0", "0"),
  };
}

function plane(id: string, z: string): PlanePrimitive {
  return {
    equation: functionSpec("z", ["z"]),
    id,
    kind: "plane",
    normal: point("0", "0", "1"),
    point: point("0", "0", z),
  };
}

function sphere(id: string, radius: string): CoordinatePrimitive {
  return {
    center: point("0", "0", "0"),
    id,
    kind: "sphere",
    radius: scalar(radius),
  };
}

function curve(
  id: string,
  domains: readonly MathVariableName[],
  components?: { x: MathAst; y: MathAst; z: MathAst }
): CoordinatePrimitive {
  return {
    function: vectorFunctionSpec(domains, components),
    id,
    kind: "parametric-curve",
  };
}

function parametricSurface(
  id: string,
  domains: readonly MathVariableName[],
  components?: { x: MathAst; y: MathAst; z: MathAst }
): CoordinatePrimitive {
  return {
    function: vectorFunctionSpec(domains, components),
    id,
    kind: "parametric-surface",
  };
}

function functionSpec(
  variable: MathVariableName,
  domains: readonly MathVariableName[],
  exclusions?: readonly MathAst[]
) {
  return functionSpecAst(variableAst(variable), domains, exclusions);
}

function functionSpecAst(
  ast: MathAst,
  domains: readonly MathVariableName[],
  exclusions?: readonly MathAst[]
) {
  return CanonicalFunctionSpec.make({
    ast,
    domain: domains.map((variable) => domain(variable)),
    exclusions: exclusions ? [...exclusions] : undefined,
  });
}

function functionSpecWithDomain(domainValue: FunctionDomain) {
  return CanonicalFunctionSpec.make({
    ast: variableAst(domainValue.variable),
    domain: [domainValue, domain("z")],
  });
}

function vectorFunctionSpec(
  domains: readonly MathVariableName[],
  components = { x: variableAst("u"), y: literalAst("0"), z: literalAst("1") }
) {
  return CanonicalVectorFunctionSpec.make({
    domain: domains.map((variable) => domain(variable)),
    ...components,
  });
}

function domain(variable: MathVariableName, min = "0", max = "1") {
  return FunctionDomain.make({
    closedMax: true,
    closedMin: true,
    max: scalar(max),
    min: scalar(min),
    variable,
  });
}

function variableAst(variable: MathVariableName) {
  return MathAst.make({
    canonical: variable,
    latex: variable,
    nodes: [{ id: variable, kind: "variable", name: variable }],
    root: variable,
  });
}

function literalAst(expression: string) {
  const nodeId = `literal-${expression}`;
  return MathAst.make({
    canonical: expression,
    latex: expression,
    nodes: [{ id: nodeId, kind: "literal", value: scalar(expression) }],
    root: nodeId,
  });
}

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({ x: scalar(x), y: scalar(y), z: scalar(z) });
}

function scalar(expression: string) {
  return ExactScalar.make({ expression, latex: expression });
}
