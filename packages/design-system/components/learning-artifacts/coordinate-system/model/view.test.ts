import {
  COORDINATE_SYSTEM_ARTIFACT_KIND,
  CoordinateSystemArtifact,
  CoordinateSystemPayload,
} from "@repo/math/schema/artifact/schema";
import { ExactPoint3, ExactScalar } from "@repo/math/schema/ast/schema";
import { RenderSamplingPolicy } from "@repo/math/schema/coordinate/primitive";
import { describe, expect, it } from "vitest";
import { readArtifactViewport, readCoordinateView } from "./view";

describe("coordinate-system/model/view", () => {
  it("centers the camera target on the artifact bounds", () => {
    const viewport = readArtifactViewport(
      payload({
        x: ["-1", "5"],
        y: ["0", "4"],
        z: ["-1", "1"],
      })
    );

    expect(viewport).toMatchObject({
      axisSize: 5,
      gridDivisions: 20,
      targetX: 2,
      targetY: 2,
      targetZ: 0,
    });
    expect(viewport.cameraX).toBeGreaterThan(viewport.targetX);
    expect(viewport.cameraY).toBeGreaterThan(viewport.targetY);
    expect(viewport.cameraZ).toBeGreaterThan(viewport.targetZ);
  });

  it("keeps tiny coordinate relationships readable with a minimum frame", () => {
    const viewport = readArtifactViewport(
      payload({
        x: ["0", "0.2"],
        y: ["0", "0.1"],
        z: ["-1", "1"],
      })
    );

    expect(viewport.axisSize).toBe(5);
    expect(viewport.gridDivisions).toBe(20);
  });

  it("falls back to the default frame for nonsortable artifact axes", () => {
    const viewport = readArtifactViewport(
      payload({
        x: ["left", "right"],
        y: ["bottom", "top"],
        z: ["near", "far"],
      })
    );

    expect(viewport).toMatchObject({
      axisSize: 10,
      targetX: 0,
      targetY: 0,
      targetZ: 0,
    });
  });

  it("clamps huge finite artifact axes to browser-safe viewport values", () => {
    const viewport = readArtifactViewport(
      payload({
        x: ["-1e308", "1e308"],
        y: ["1e308", "1e308"],
        z: ["-1", "1"],
      })
    );

    expect(viewport.axisSize).toBe(1000);
    expect(viewport.targetX).toBe(0);
    expect(viewport.targetY).toBe(0);
    expect(viewport.cameraX).toBe(1250);
  });

  it("encodes schema-class artifacts before client rendering", () => {
    const view = readCoordinateView(
      CoordinateSystemArtifact.make({
        id: "line-through-two-points",
        kind: COORDINATE_SYSTEM_ARTIFACT_KIND,
        payload: payload({
          x: ["0", "3"],
          y: ["0", "2"],
          z: ["-1", "1"],
        }),
        proofAnchors: ["math.tool.geometry"],
        title: "Line through two points",
      })
    );

    expect(view.artifact).not.toBeInstanceOf(CoordinateSystemArtifact);
    expect(JSON.parse(JSON.stringify(view.artifact))).toMatchObject({
      id: "line-through-two-points",
      title: "Line through two points",
    });
    expect(view.viewport.axisSize).toBe(5);
  });
});

/** Creates a minimal coordinate-system payload for viewport model tests. */
function payload(axes: {
  readonly x: readonly [string, string];
  readonly y: readonly [string, string];
  readonly z: readonly [string, string];
}) {
  return CoordinateSystemPayload.make({
    axes: {
      x: [scalar(axes.x[0]), scalar(axes.x[1])],
      y: [scalar(axes.y[0]), scalar(axes.y[1])],
      z: [scalar(axes.z[0]), scalar(axes.z[1])],
    },
    primitives: [
      {
        id: "origin",
        kind: "point",
        point: point("0", "0", "0"),
      },
    ],
    sampling: RenderSamplingPolicy.make({
      curveSamples: 16,
      surfaceCells: 8,
    }),
  });
}

/** Creates one exact point fixture for the required payload primitive. */
function point(x: string, y: string, z: string) {
  return ExactPoint3.make({ x: scalar(x), y: scalar(y), z: scalar(z) });
}

/** Creates one exact scalar fixture for viewport model tests. */
function scalar(expression: string) {
  const decimal = Number(expression);

  return ExactScalar.make({
    ...(Number.isFinite(decimal) ? { decimal } : {}),
    expression,
    latex: expression,
  });
}
