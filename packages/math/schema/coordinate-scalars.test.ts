import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast";
import {
  isExactZeroPoint,
  readSortableExactScalar,
} from "@repo/math/schema/coordinate-scalars";
import {
  CoordinatePrimitiveInvariantError,
  findCoordinatePrimitiveIssue,
} from "@repo/math/schema/coordinate-validation";
import { describe, expect, it } from "vitest";

describe("coordinate scalar invariants", () => {
  it("rejects decimal hints when exact expressions are unparseable", () => {
    expect(
      readIssueMessage([
        {
          direction: ExactPoint3.make({
            x: scalarDecimal("dx", 0),
            y: scalar("0"),
            z: scalar("0"),
          }),
          id: "line-symbolic-not-zero",
          kind: "line",
          point: point("1", "0", "0"),
        },
      ])
    ).toBe(
      "Coordinate primitive line-symbolic-not-zero line direction x-coordinate must use a sortable numeric value."
    );
  });

  it("rejects decimal hints as sortable values for invalid exact math", () => {
    expect(readSortableExactScalar(scalarDecimal("left", 0))).toBeUndefined();
  });

  it("accepts allowlisted exact numeric forms", () => {
    expect(readSortableExactScalar(scalar("1/2"))).toBe(0.5);
    expect(readSortableExactScalar(scalarDecimal("pi/2", 1.5708))).toBeCloseTo(
      Math.PI / 2
    );
    expect(readSortableExactScalar(scalar("2*π/3"))).toBeCloseTo(
      (2 * Math.PI) / 3
    );
    expect(readSortableExactScalar(scalar("1/2*pi"))).toBeCloseTo(Math.PI / 2);
    expect(readSortableExactScalar(scalar("1/(2)*pi"))).toBeCloseTo(
      Math.PI / 2
    );
    expect(readSortableExactScalar(scalar("-pi/2"))).toBeCloseTo(-Math.PI / 2);
    expect(readSortableExactScalar(scalar("+pi"))).toBe(Math.PI);
    expect(readSortableExactScalar(scalar("(1)/2"))).toBe(0.5);
    expect(readSortableExactScalar(scalar("(1)/(2)"))).toBe(0.5);
    expect(readSortableExactScalar(scalar("1/2/3"))).toBeCloseTo(1 / 6);
    expect(readSortableExactScalar(scalar("1/(2*pi)"))).toBeCloseTo(
      1 / (2 * Math.PI)
    );
  });

  it("rejects malformed exact numeric forms", () => {
    expect(readSortableExactScalar(scalar("1/"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1/0"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1/left"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1/(2"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1)/2"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("2**pi"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("2*left"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("-left"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1 2"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1e9999"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1e308*1e308"))).toBeUndefined();
    expect(readSortableExactScalar(scalar("1e308/1e-308"))).toBeUndefined();
  });

  it("rejects nonsortable exact direction components before zero checks", () => {
    const direction = ExactPoint3.make({
      x: scalar("left"),
      y: scalar("0"),
      z: scalar("0"),
    });

    expect(isExactZeroPoint(direction)).toBe(false);
    expect(
      readIssueMessage([
        {
          direction,
          id: "line-nonsortable-not-zero",
          kind: "line",
          point: point("1", "0", "0"),
        },
      ])
    ).toBe(
      "Coordinate primitive line-nonsortable-not-zero line direction x-coordinate must use a sortable numeric value."
    );
  });

  it("rejects raw blank exact expressions defensively", () => {
    const blankScalar = { expression: " ", latex: " " };
    const blankPoint = {
      x: blankScalar,
      y: scalar("0"),
      z: scalar("0"),
    };

    expect(readSortableExactScalar(blankScalar)).toBeUndefined();
    expect(isExactZeroPoint(blankPoint)).toBe(false);
  });
});

function readIssueMessage(
  primitives: Parameters<typeof findCoordinatePrimitiveIssue>[0]
) {
  const issue = findCoordinatePrimitiveIssue(primitives);

  expect(issue).toBeInstanceOf(CoordinatePrimitiveInvariantError);
  return issue?.message;
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

function scalarDecimal(expression: string, decimal: number) {
  return ExactScalar.make({
    decimal,
    expression,
    latex: expression,
  });
}
