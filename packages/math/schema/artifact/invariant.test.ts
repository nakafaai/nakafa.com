import { findLearningArtifactInvariantIssue } from "@repo/math/schema/artifact/invariant";
import {
  CoordinateSystemArtifact,
  CoordinateSystemPayload,
} from "@repo/math/schema/artifact/schema";
import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import {
  type CoordinatePrimitive,
  RenderSamplingPolicy,
} from "@repo/math/schema/coordinate/primitive";
import { describe, expect, it } from "vitest";

describe("learning artifact cross-field invariants", () => {
  it("rejects duplicate primitive ids inside one coordinate artifact", () => {
    expect(
      findLearningArtifactInvariantIssue(
        artifact({
          primitives: [
            pointPrimitive("point-1", "0"),
            pointPrimitive("point-1", "1"),
          ],
        })
      )
    ).toBe("Duplicate coordinate primitive id: point-1.");
  });

  it("rejects nonsortable and inverted axis ranges", () => {
    const cases = [
      {
        axes: {
          x: axisRange("left", "1"),
          y: axisRange("-1", "1"),
          z: axisRange("-1", "1"),
        },
        expected:
          "Coordinate artifact x-axis range must use sortable numeric bounds.",
      },
      {
        axes: {
          x: axisRange("-1", "1"),
          y: axisRange("1", "right"),
          z: axisRange("-1", "1"),
        },
        expected:
          "Coordinate artifact y-axis range must use sortable numeric bounds.",
      },
      {
        axes: {
          x: axisRange("-1", "1"),
          y: axisRange("-1", "1"),
          z: axisRange("2", "1"),
        },
        expected: "Coordinate artifact z-axis range must be increasing.",
      },
    ];

    for (const testCase of cases) {
      expect(findLearningArtifactInvariantIssue(artifact(testCase))).toBe(
        testCase.expected
      );
    }
  });
});

function artifact(
  input: {
    axes?: {
      x: readonly [ExactScalar, ExactScalar];
      y: readonly [ExactScalar, ExactScalar];
      z: readonly [ExactScalar, ExactScalar];
    };
    primitives?: CoordinatePrimitive[];
  } = {}
) {
  return CoordinateSystemArtifact.make({
    id: "artifact-coordinate-1",
    kind: "coordinate-system-3d",
    payload: CoordinateSystemPayload.make({
      axes: input.axes ?? {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("-1"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
      primitives: input.primitives ?? [pointPrimitive("point-1", "0")],
      sampling: RenderSamplingPolicy.make({
        curveSamples: 16,
        surfaceCells: 16,
      }),
    }),
    proofAnchors: ["cas://coordinate/artifact"],
    title: "Coordinate artifact",
  });
}

function axisRange(
  min: string,
  max: string
): readonly [ExactScalar, ExactScalar] {
  return [scalar(min), scalar(max)];
}

function pointPrimitive(id: string, x: string): CoordinatePrimitive {
  return {
    id,
    kind: "point",
    point: point(x, "0", "0"),
  };
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
