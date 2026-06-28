// @vitest-environment node
import {
  createCircleArcLine,
  createCircleArcPoints,
  createCircleChordPoints,
  createCircleOutlinePoints,
  createCirclePoint,
  createCircleRadiusPoints,
  createCircleSegmentBoundaryLines,
} from "@repo/design-system/components/contents/mathematics/circle";
import { describe, expect, it } from "vitest";

const EXPECTED_PRECISION = 12;

/**
 * Asserts generated graph coordinates without depending on exact floating
 * point string output from trigonometric functions.
 */
function expectPointClose(
  point: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number }
) {
  expect(point.x).toBeCloseTo(expected.x, EXPECTED_PRECISION);
  expect(point.y).toBeCloseTo(expected.y, EXPECTED_PRECISION);
  expect(point.z).toBeCloseTo(expected.z, EXPECTED_PRECISION);
}

describe("circle visual geometry", () => {
  it("creates exact circle points from degree measures", () => {
    expectPointClose(createCirclePoint(4, 0), { x: 4, y: 0, z: 0 });
    expectPointClose(createCirclePoint(4, 90), { x: 0, y: 4, z: 0 });
  });

  it("samples directed arc endpoints from the same point formula", () => {
    const arcPoints = createCircleArcPoints({
      radius: 4,
      segments: 4,
      startDegrees: 45,
      sweepDegrees: 240,
    });

    expect(arcPoints).toHaveLength(5);
    expectPointClose(arcPoints[0], createCirclePoint(4, 45));
    expectPointClose(
      arcPoints.at(-1) ?? arcPoints[0],
      createCirclePoint(4, 285)
    );
  });

  it("uses the shared arc quality budget by default", () => {
    const arcPoints = createCircleArcPoints({
      radius: 4,
      startDegrees: 30,
      sweepDegrees: 120,
    });

    expect(arcPoints.length).toBeGreaterThan(4);
    expectPointClose(arcPoints[0], createCirclePoint(4, 30));
    expectPointClose(
      arcPoints.at(-1) ?? arcPoints[0],
      createCirclePoint(4, 150)
    );
  });

  it("creates a closed full-circle outline", () => {
    const outlinePoints = createCircleOutlinePoints(4);

    expect(outlinePoints.length).toBeGreaterThan(4);
    expectPointClose(
      outlinePoints[0],
      outlinePoints.at(-1) ?? outlinePoints[0]
    );
  });

  it("creates radius lines from the center to exact circle points", () => {
    const radiusPoints = createCircleRadiusPoints({ radius: 4, degrees: 30 });

    expect(radiusPoints).toHaveLength(2);
    expectPointClose(radiusPoints[0], { x: 0, y: 0, z: 0 });
    expectPointClose(radiusPoints[1], createCirclePoint(4, 30));
  });

  it("creates chord endpoints from the same arc endpoints", () => {
    const arc = { radius: 4, startDegrees: 30, sweepDegrees: 120 };
    const arcPoints = createCircleArcPoints({ ...arc, segments: 4 });
    const chordPoints = createCircleChordPoints(arc);

    expect(chordPoints).toHaveLength(2);
    expectPointClose(chordPoints[0], arcPoints[0]);
    expectPointClose(chordPoints[1], arcPoints.at(-1) ?? arcPoints[0]);
  });

  it("creates arc lines with progress-based labels", () => {
    const arcLine = createCircleArcLine({
      color: "amber",
      label: {
        offset: [0, -0.5, 0],
        text: "120°",
      },
      radius: 1.5,
      segments: 4,
      startDegrees: 30,
      sweepDegrees: 120,
    });

    expect(arcLine).toMatchObject({
      color: "amber",
      labels: [{ at: 2, offset: [0, -0.5, 0], text: "120°" }],
      showPoints: false,
      smooth: true,
    });
    if (!arcLine.labels) {
      throw new Error("Expected arc line to include a label");
    }
    expect(arcLine.labels[0]).not.toHaveProperty("progress");
    expect(arcLine.points).toHaveLength(5);
  });

  it("clamps arc line label progress to visible arc points", () => {
    const arcLine = createCircleArcLine({
      color: "amber",
      label: {
        offset: [0, -0.5, 0],
        progress: -1,
        text: "start",
      },
      radius: 1.5,
      segments: 4,
      startDegrees: 30,
      sweepDegrees: 120,
    });

    if (!arcLine.labels) {
      throw new Error("Expected clamped arc line to include a label");
    }
    expect(arcLine.labels[0]).toMatchObject({ at: 0, text: "start" });
  });

  it("keeps circle segment arcs smooth and chords straight", () => {
    const [arcLine, chordLine] = createCircleSegmentBoundaryLines({
      color: "orange",
      label: {
        offset: [0, -1.5, 0],
        progress: 2,
        text: "Major Segment",
      },
      radius: 4,
      segments: 4,
      startDegrees: 45,
      sweepDegrees: 240,
    });

    expect(arcLine).toMatchObject({
      color: "orange",
      labels: [{ at: 4, offset: [0, -1.5, 0], text: "Major Segment" }],
      lineWidth: 4,
      showPoints: false,
      smooth: true,
    });
    expect(chordLine).toMatchObject({
      color: "orange",
      lineWidth: 4,
      showPoints: false,
      smooth: false,
    });
    expect(arcLine.points).toHaveLength(5);
    expect(chordLine.points).toHaveLength(2);
    if (!arcLine.labels) {
      throw new Error("Expected major segment arc line to include a label");
    }
    expect(arcLine.labels[0]).not.toHaveProperty("progress");
    expectPointClose(chordLine.points[0], arcLine.points[0]);
    expectPointClose(
      chordLine.points[1],
      arcLine.points.at(-1) ?? arcLine.points[0]
    );
  });

  it("builds unlabeled segment boundaries", () => {
    const [arcLine, chordLine] = createCircleSegmentBoundaryLines({
      color: "lime",
      lineWidth: 2,
      radius: 4,
      segments: 0,
      startDegrees: 30,
      sweepDegrees: 120,
    });

    expect(arcLine).toMatchObject({
      color: "lime",
      lineWidth: 2,
      showPoints: false,
      smooth: true,
    });
    expect(arcLine).not.toHaveProperty("labels");
    expect(chordLine).toMatchObject({
      color: "lime",
      lineWidth: 2,
      showPoints: false,
      smooth: false,
    });
    expect(arcLine.points).toHaveLength(2);
  });
});
