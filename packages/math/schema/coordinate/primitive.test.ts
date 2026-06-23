import {
  ExactPoint3,
  ExactScalar,
  MathAst,
} from "@repo/math/schema/ast/schema";
import {
  COORDINATE_PRIMITIVE_KIND_VALUES,
  CoordinatePrimitiveSchema,
  MAX_COORDINATE_PRIMITIVE_ID_LENGTH,
  MAX_FUNCTION_DOMAINS,
  MAX_FUNCTION_EXCLUSIONS,
  MAX_POLYGON_VERTICES,
  readCoordinatePrimitiveMathAsts,
} from "@repo/math/schema/coordinate/primitive";
import { Effect, Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("CoordinatePrimitiveSchema", () => {
  it("decodes the full deterministic primitive family", async () => {
    const decoded = await Promise.all(
      primitiveFamily().map((primitive) =>
        Effect.runPromise(decodePrimitive(primitive))
      )
    );

    expect(decoded.map((primitive) => primitive.kind)).toEqual([
      ...COORDINATE_PRIMITIVE_KIND_VALUES,
    ]);
    expect(JSON.stringify(decoded)).not.toContain("samples");
    expect(JSON.stringify(decoded)).not.toContain("points");
  });

  it("bounds primitive ids, polygons, domains, and exclusions", async () => {
    const cases = [
      { id: "   ", kind: "point", point: point("0", "0", "0") },
      {
        id: `primitive-${"x".repeat(MAX_COORDINATE_PRIMITIVE_ID_LENGTH)}`,
        kind: "point",
        point: point("0", "0", "0"),
      },
      {
        id: "dense-polygon",
        kind: "polygon",
        vertices: Array.from({ length: MAX_POLYGON_VERTICES + 1 }, (_, x) =>
          point(String(x), "0", "0")
        ),
      },
      {
        function: scalarFunction("x", {
          exclusions: Array.from(
            { length: MAX_FUNCTION_EXCLUSIONS + 1 },
            (_, index) => literalAst(String(index))
          ),
        }),
        id: "dense-exclusions",
        kind: "function-surface",
        outputAxis: "z",
      },
      {
        function: scalarFunction("x", {
          domains: longDomains(),
        }),
        id: "dense-scalar-domains",
        kind: "function-surface",
        outputAxis: "z",
      },
      {
        function: {
          domain: longDomains(),
          x: variableAst("x"),
          y: literalAst("0"),
          z: literalAst("1"),
        },
        id: "dense-vector-domains",
        kind: "parametric-surface",
      },
    ];

    for (const primitive of cases) {
      await expectInvalidPrimitive(primitive);
    }
  });

  it("reads all embedded MathAst contracts from symbolic primitives", async () => {
    const decoded = await Promise.all(
      primitiveFamily().map((primitive) =>
        Effect.runPromise(decodePrimitive(primitive))
      )
    );
    const asts = readCoordinatePrimitiveMathAsts(decoded);

    expect(asts.map((ast) => ast.canonical)).toEqual([
      "z",
      "0",
      "t",
      "0",
      "1",
      "x",
      "u",
      "v",
      "0",
    ]);
  });
});

const decodePrimitive = Schema.decodeUnknown(CoordinatePrimitiveSchema);

function primitiveFamily() {
  return [
    { id: "point-1", kind: "point", point: point("0", "0", "0") },
    { id: "vector-1", kind: "vector", vector: point("1", "0", "0") },
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
      equation: scalarFunction("z", { exclusions: [literalAst("0")] }),
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
      function: vectorFunction("t"),
      id: "parametric-curve-1",
      kind: "parametric-curve",
    },
    {
      function: scalarFunction("x"),
      id: "function-surface-1",
      kind: "function-surface",
      outputAxis: "y",
    },
    {
      function: surfaceFunction(),
      id: "parametric-surface-1",
      kind: "parametric-surface",
    },
  ];
}

function scalarFunction(
  variable: "x" | "z",
  input: {
    domains?: readonly ReturnType<typeof domain>[];
    exclusions?: readonly MathAst[];
  } = {}
) {
  return {
    ast: variableAst(variable),
    domain: input.domains ?? [
      domain(variable),
      domain(variable === "x" ? "z" : "x"),
    ],
    exclusions: input.exclusions,
    verifiedBy: "cas://proof/function",
  };
}

function vectorFunction(variable: "t") {
  return {
    domain: [domain(variable)],
    x: variableAst(variable),
    y: literalAst("0"),
    z: literalAst("1"),
  };
}

function surfaceFunction() {
  return {
    domain: [domain("u"), domain("v")],
    x: variableAst("u"),
    y: variableAst("v"),
    z: literalAst("0"),
  };
}

function longDomains() {
  return Array.from({ length: MAX_FUNCTION_DOMAINS + 1 }, (_, index) => {
    if (index === 0) {
      return domain("x");
    }
    if (index === 1) {
      return domain("y");
    }
    if (index === 2) {
      return domain("z");
    }
    return domain("t");
  });
}

function domain(variable: "t" | "u" | "v" | "x" | "y" | "z") {
  return {
    closedMax: true,
    closedMin: true,
    max: scalar("5"),
    min: scalar("-5"),
    variable,
  };
}

function variableAst(variable: "t" | "u" | "v" | "x" | "y" | "z") {
  return MathAst.make({
    canonical: variable,
    latex: variable,
    nodes: [{ id: variable, kind: "variable", name: variable }],
    root: variable,
  });
}

function literalAst(expression: string) {
  return MathAst.make({
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
  });
}

function point(x: string, y: string, z: string) {
  return ExactPoint3.make({ x: scalar(x), y: scalar(y), z: scalar(z) });
}

function scalar(expression: string) {
  return ExactScalar.make({ expression, latex: expression });
}

async function expectInvalidPrimitive(input: unknown) {
  const exit = await Effect.runPromiseExit(decodePrimitive(input));
  expect(Exit.isFailure(exit)).toBe(true);
}
