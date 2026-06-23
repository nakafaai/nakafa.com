import { deriveCoordinateArtifactsFromMathData } from "@repo/math/artifact/derive";
import type { MathData } from "@repo/math/schema/data";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("deriveCoordinateArtifactsFromMathData", () => {
  it("derives a bounded coordinate artifact from verified point geometry", async () => {
    const artifacts = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-geometry-segment",
        data: mathData({
          points: [
            { x: "0", y: "1" },
            { x: "4", y: "3" },
          ],
        }),
        proofAnchor: "math:tool-1",
      })
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      id: "artifact-geometry-segment",
      kind: "coordinate-system-3d",
      payload: {
        primitives: [
          expect.objectContaining({ kind: "point" }),
          expect.objectContaining({ kind: "point" }),
          expect.objectContaining({ kind: "segment" }),
        ],
      },
      proofAnchors: ["math:tool-1"],
    });
  });

  it("does not emit artifacts for unverified or symbolic point evidence", async () => {
    const unverified = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-unverified",
        data: mathData({ status: "inconclusive" }),
        proofAnchor: "math:tool-2",
      })
    );
    const symbolic = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-symbolic",
        data: mathData({
          points: [
            { x: "left", y: "1" },
            { x: "4", y: "3" },
          ],
        }),
        proofAnchor: "math:tool-3",
      })
    );

    expect(unverified).toEqual([]);
    expect(symbolic).toEqual([]);
  });

  it("does not emit artifacts for loading or unsupported math data", async () => {
    const loading = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-loading",
        data: {
          input: {
            expression: "1 + 1",
            kind: "math",
            operation: "evaluate",
          },
          kind: "evaluate",
          status: "loading",
        },
        proofAnchor: "math:tool-loading",
      })
    );
    const unsupported = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-unsupported",
        data: mathData({ operation: "evaluate" }),
        proofAnchor: "math:tool-unsupported",
      })
    );

    expect(loading).toEqual([]);
    expect(unsupported).toEqual([]);
  });

  it("requires at least two sortable points before emitting an artifact", async () => {
    const artifacts = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-one-point",
        data: mathData({ points: [{ x: "0", y: "1" }] }),
        proofAnchor: "math:tool-one-point",
      })
    );

    expect(artifacts).toEqual([]);
  });

  it("does not emit artifacts when verified geometry has no retained points", async () => {
    const artifacts = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-no-points",
        data: mathData({ includePoints: false }),
        proofAnchor: "math:tool-no-points",
      })
    );

    expect(artifacts).toEqual([]);
  });

  it("uses proportional axis padding for wide coordinate spans", async () => {
    const artifacts = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-wide-span",
        data: mathData({
          points: [
            { x: "-100", y: "0" },
            { x: "100", y: "0" },
          ],
        }),
        proofAnchor: "math:tool-wide-span",
      })
    );

    expect(artifacts[0]?.payload.axes.x).toMatchObject([
      { expression: "-120" },
      { expression: "120" },
    ]);
  });

  it("derives two segments for verified line intersection evidence", async () => {
    const artifacts = await Effect.runPromise(
      deriveCoordinateArtifactsFromMathData({
        artifactId: "artifact-intersection",
        data: mathData({
          operation: "intersection",
          points: [
            { x: "0", y: "0" },
            { x: "2", y: "2" },
            { x: "0", y: "2" },
            { x: "2", y: "0" },
          ],
        }),
        proofAnchor: "math:tool-intersection",
      })
    );

    expect(artifacts[0]?.payload.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "segment-1", kind: "segment" }),
        expect.objectContaining({ id: "segment-2", kind: "segment" }),
      ])
    );
  });

  it("returns a typed derivation error when artifact decoding fails", async () => {
    const exit = await Effect.runPromiseExit(
      deriveCoordinateArtifactsFromMathData({
        artifactId: " ",
        data: mathData(),
        proofAnchor: "math:tool-invalid-artifact",
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

/** Builds a minimal verified point-geometry data part fixture. */
function mathData({
  includePoints = true,
  operation = "line",
  points = [
    { x: "0", y: "1" },
    { x: "4", y: "3" },
  ],
  status = "verified",
}: {
  readonly includePoints?: boolean;
  readonly operation?: "evaluate" | "intersection" | "line";
  readonly points?: readonly { readonly x: string; readonly y: string }[];
  readonly status?: "inconclusive" | "verified";
} = {}): MathData {
  const inputPoints = includePoints ? [...points] : undefined;

  return {
    input: {
      kind: "math",
      operation,
      ...(inputPoints ? { points: inputPoints } : {}),
    },
    kind: operation,
    result: {
      conditions: [],
      input: {
        kind: "math",
        operation,
        ...(inputPoints ? { points: inputPoints } : {}),
      },
      items: [],
      kind: operation,
      operation,
      primary: {
        expression: "line through points",
        latex: "line",
      },
      reason: "CAS verified the coordinate geometry result.",
      stepStatus: "complete",
      steps: [],
      status,
    },
    status,
    summary: status,
  };
}
