import {
  ExactPoint3,
  ExactScalar,
  MathAst,
  type MathVariableName,
} from "@repo/math/schema/ast";
import {
  CanonicalFunctionSpec,
  type CoordinatePrimitive,
  FunctionDomain,
} from "@repo/math/schema/coordinate-primitives";
import {
  CoordinatePrimitiveInvariantError,
  findCoordinatePrimitiveIssue,
} from "@repo/math/schema/coordinate-validation";
import { describe, expect, it } from "vitest";

describe("coordinate point-like primitive validation", () => {
  const cases: {
    expected: string;
    name: string;
    primitive: CoordinatePrimitive;
  }[] = [
    {
      expected:
        "Coordinate primitive point-bad point x-coordinate must use a sortable numeric value.",
      name: "point coordinates",
      primitive: {
        id: "point-bad",
        kind: "point",
        point: point("left", "0", "0"),
      },
    },
    {
      expected:
        "Coordinate primitive vector-tail-bad vector tail y-coordinate must use a sortable numeric value.",
      name: "vector tails",
      primitive: {
        id: "vector-tail-bad",
        kind: "vector",
        tail: point("0", "top", "0"),
        vector: point("1", "0", "0"),
      },
    },
    {
      expected:
        "Coordinate primitive vector-bad vector z-coordinate must use a sortable numeric value.",
      name: "vector components",
      primitive: {
        id: "vector-bad",
        kind: "vector",
        tail: point("0", "0", "0"),
        vector: point("1", "0", "far"),
      },
    },
    {
      expected:
        "Coordinate primitive segment-start-bad segment start y-coordinate must use a sortable numeric value.",
      name: "segment start points",
      primitive: {
        end: point("1", "0", "0"),
        id: "segment-start-bad",
        kind: "segment",
        start: point("0", "below", "0"),
      },
    },
    {
      expected:
        "Coordinate primitive segment-end-bad segment end x-coordinate must use a sortable numeric value.",
      name: "segment end points",
      primitive: {
        end: point("right", "0", "0"),
        id: "segment-end-bad",
        kind: "segment",
        start: point("0", "0", "0"),
      },
    },
    {
      expected:
        "Coordinate primitive ray-origin-bad ray origin x-coordinate must use a sortable numeric value.",
      name: "ray origins",
      primitive: {
        direction: point("1", "0", "0"),
        id: "ray-origin-bad",
        kind: "ray",
        origin: point("left", "0", "0"),
      },
    },
    {
      expected:
        "Coordinate primitive line-point-bad line point y-coordinate must use a sortable numeric value.",
      name: "line points",
      primitive: {
        direction: point("1", "0", "0"),
        id: "line-point-bad",
        kind: "line",
        point: point("0", "above", "0"),
      },
    },
    {
      expected:
        "Coordinate primitive plane-point-bad plane point z-coordinate must use a sortable numeric value.",
      name: "plane points",
      primitive: {
        equation: functionSpec("z"),
        id: "plane-point-bad",
        kind: "plane",
        normal: point("0", "0", "1"),
        point: point("0", "0", "near"),
      },
    },
    {
      expected:
        "Coordinate primitive polygon-bad polygon vertex 2 x-coordinate must use a sortable numeric value.",
      name: "polygon vertices",
      primitive: {
        id: "polygon-bad",
        kind: "polygon",
        vertices: [
          point("0", "0", "0"),
          point("left", "0", "0"),
          point("0", "1", "0"),
        ],
      },
    },
    {
      expected:
        "Coordinate primitive sphere-center-bad sphere center x-coordinate must use a sortable numeric value.",
      name: "sphere centers",
      primitive: {
        center: point("left", "0", "0"),
        id: "sphere-center-bad",
        kind: "sphere",
        radius: scalar("1"),
      },
    },
  ];

  for (const testCase of cases) {
    it(`rejects nonsortable ${testCase.name}`, () => {
      expect(readIssueMessage([testCase.primitive])).toBe(testCase.expected);
    });
  }

  it("rejects zero-length segment primitives", () => {
    expect(
      readIssueMessage([
        {
          end: point("1", "2", "3"),
          id: "segment-zero",
          kind: "segment",
          start: point("1", "2", "3"),
        },
      ])
    ).toBe(
      "Coordinate primitive segment-zero segment endpoints must be distinct."
    );
  });

  it("rejects duplicate polygon vertices", () => {
    expect(
      readIssueMessage([
        {
          id: "polygon-duplicate",
          kind: "polygon",
          vertices: [
            point("0", "0", "0"),
            point("1", "0", "0"),
            point("0", "0", "0"),
          ],
        },
      ])
    ).toBe(
      "Coordinate primitive polygon-duplicate polygon vertex 3 must not duplicate vertex 1."
    );
  });

  it("rejects zero-area polygon primitives", () => {
    expect(
      readIssueMessage([
        {
          id: "polygon-collinear",
          kind: "polygon",
          vertices: [
            point("0", "0", "0"),
            point("1", "1", "1"),
            point("2", "2", "2"),
          ],
        },
      ])
    ).toBe(
      "Coordinate primitive polygon-collinear polygon vertices must enclose nonzero area."
    );
  });

  it("defensively rejects empty polygon geometry", () => {
    expect(
      readIssueMessage([
        {
          id: "polygon-empty",
          kind: "polygon",
          vertices: [],
        },
      ])
    ).toBe(
      "Coordinate primitive polygon-empty polygon vertices must enclose nonzero area."
    );
  });

  it("accepts non-collinear polygon primitives", () => {
    expect(
      findCoordinatePrimitiveIssue([
        {
          id: "polygon-area",
          kind: "polygon",
          vertices: [
            point("0", "0", "0"),
            point("1", "0", "0"),
            point("0", "1", "0"),
          ],
        },
      ])
    ).toBeUndefined();
  });
});

function readIssueMessage(
  primitives: Parameters<typeof findCoordinatePrimitiveIssue>[0]
) {
  const issue = findCoordinatePrimitiveIssue(primitives);

  expect(issue).toBeInstanceOf(CoordinatePrimitiveInvariantError);
  return issue?.message;
}

function functionSpec(variable: MathVariableName) {
  return CanonicalFunctionSpec.make({
    ast: variableAst(variable),
    domain: [domain(variable)],
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
    nodes: [{ id: variable, kind: "variable", name: variable }],
    root: variable,
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
