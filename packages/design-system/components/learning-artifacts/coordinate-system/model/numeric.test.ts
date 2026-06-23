import {
  ExactPoint3,
  ExactScalar,
  MathAst,
} from "@repo/math/schema/ast/schema";
import { FunctionDomain } from "@repo/math/schema/coordinate/primitive";
import { describe, expect, it } from "vitest";
import {
  readDomainInterval,
  readSampleValue,
  readScalarNumber,
  readVector3,
} from "./numeric";

describe("coordinate-system/model/numeric", () => {
  it("reads finite exact scalars and points for renderer geometry", () => {
    const point = ExactPoint3.make({
      x: scalar("1"),
      y: scalar("2"),
      z: scalar("3"),
    });

    expect(readScalarNumber(scalar("4"))).toBe(4);
    expect(readVector3(point)?.toArray()).toEqual([1, 2, 3]);
  });

  it("rejects non-increasing function domains before sampling", () => {
    const domain = FunctionDomain.make({
      closedMax: true,
      closedMin: true,
      max: ExactScalar.make({ decimal: 1, expression: "1", latex: "1" }),
      min: ExactScalar.make({ decimal: 1, expression: "1", latex: "1" }),
      variable: "x",
    });

    expect(readDomainInterval(domain)).toBeUndefined();
  });

  it("drops points with nonsortable exact coordinates", () => {
    const point = ExactPoint3.make({
      x: ExactScalar.make({ expression: "left", latex: "left" }),
      y: scalar("2"),
      z: scalar("3"),
    });

    expect(readVector3(point)).toBeUndefined();
  });

  it("drops MathAst samples that cannot be evaluated with renderer variables", () => {
    const ast = MathAst.make({
      canonical: "x",
      latex: "x",
      nodes: [
        {
          id: "root",
          kind: "variable",
          name: "x",
        },
      ],
      root: "root",
    });

    expect(readSampleValue(ast, new Map())).toBeUndefined();
  });
});

const scalar = (expression: string) =>
  ExactScalar.make({
    decimal: Number(expression),
    expression,
    latex: expression,
  });
