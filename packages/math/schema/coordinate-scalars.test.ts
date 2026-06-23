import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast";
import {
  CoordinatePrimitiveInvariantError,
  findCoordinatePrimitiveIssue,
} from "@repo/math/schema/coordinate-validation";
import { describe, expect, it } from "vitest";

describe("coordinate scalar invariants", () => {
  it("uses decimal hints only after symbolic exact expressions for zero checks", () => {
    expect(
      readIssueMessage([
        {
          direction: ExactPoint3.make({
            x: scalarDecimal("dx", 0),
            y: scalar("0"),
            z: scalar("0"),
          }),
          id: "line-symbolic-zero",
          kind: "line",
          point: point("1", "0", "0"),
        },
      ])
    ).toBe(
      "Coordinate primitive line-symbolic-zero has a zero direction vector."
    );
  });

  it("does not treat blank exact expressions as zero direction components", () => {
    expect(
      findCoordinatePrimitiveIssue([
        {
          direction: ExactPoint3.make({
            x: scalarDecimal(" ", 0),
            y: scalar("0"),
            z: scalar("0"),
          }),
          id: "line-blank-not-zero",
          kind: "line",
          point: point("1", "0", "0"),
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
