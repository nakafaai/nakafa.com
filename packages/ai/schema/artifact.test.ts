import {
  buildLearningArtifactManifest,
  encodeLearningArtifactWrite,
  isSameLearningArtifactManifest,
  LearningArtifactManifestSchema,
} from "@repo/ai/schema/artifact";
import { MAX_COORDINATE_ARTIFACT_BYTES } from "@repo/math/schema/artifact/safety";
import type { LearningArtifact } from "@repo/math/schema/artifact/schema";
import { Effect, Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("LearningArtifactManifestSchema", () => {
  it("accepts bounded artifact manifests for chat transcript parts", () => {
    expect(
      Schema.decodeUnknownSync(LearningArtifactManifestSchema)({
        artifactId: "artifact-manifest-1",
        bounds: {
          x: { max: "1", min: "-1" },
          y: { max: "1", min: "-1" },
          z: { max: "1", min: "-1" },
        },
        kind: "coordinate-system-3d",
        payloadBytes: 512,
        primitiveCount: 1,
        schemaVersion: 1,
        title: "Coordinate artifact",
      })
    ).toMatchObject({
      artifactId: "artifact-manifest-1",
      primitiveCount: 1,
    });
  });

  it("rejects over-budget manifest metadata before transcript persistence", () => {
    expect(() =>
      Schema.decodeUnknownSync(LearningArtifactManifestSchema)({
        artifactId: "artifact-manifest-2",
        bounds: {
          x: { max: "1", min: "-1" },
          y: { max: "1", min: "-1" },
          z: { max: "1", min: "-1" },
        },
        kind: "coordinate-system-3d",
        payloadBytes: MAX_COORDINATE_ARTIFACT_BYTES + 1,
        primitiveCount: 1,
        schemaVersion: 1,
        title: "Coordinate artifact",
      })
    ).toThrow();
  });

  it("builds one manifest from a decoded coordinate artifact payload", async () => {
    const manifest = await Effect.runPromise(
      buildLearningArtifactManifest(
        coordinateArtifact({
          id: "artifact-manifest-3",
          title: " Coordinate artifact ",
        })
      )
    );

    expect(manifest).toMatchObject({
      artifactId: "artifact-manifest-3",
      primitiveCount: 1,
      schemaVersion: 1,
      title: "Coordinate artifact",
    });
    expect(isSameLearningArtifactManifest(manifest, manifest)).toBe(true);
  });

  it("detects manifest field drift explicitly", async () => {
    const manifest = await Effect.runPromise(
      buildLearningArtifactManifest(
        coordinateArtifact({ description: "Retained summary." })
      )
    );

    const changedManifests = [
      { ...manifest, artifactId: "other-artifact" },
      { ...manifest, title: "Other title" },
      { ...manifest, description: "Other description." },
      { ...manifest, payloadBytes: manifest.payloadBytes + 1 },
      { ...manifest, primitiveCount: manifest.primitiveCount + 1 },
      {
        ...manifest,
        bounds: {
          ...manifest.bounds,
          x: { ...manifest.bounds.x, min: "-2" },
        },
      },
      {
        ...manifest,
        bounds: {
          ...manifest.bounds,
          x: { ...manifest.bounds.x, max: "2" },
        },
      },
      {
        ...manifest,
        bounds: {
          ...manifest.bounds,
          y: { ...manifest.bounds.y, min: "-2" },
        },
      },
      {
        ...manifest,
        bounds: {
          ...manifest.bounds,
          y: { ...manifest.bounds.y, max: "2" },
        },
      },
      {
        ...manifest,
        bounds: {
          ...manifest.bounds,
          z: { ...manifest.bounds.z, min: "-2" },
        },
      },
      {
        ...manifest,
        bounds: {
          ...manifest.bounds,
          z: { ...manifest.bounds.z, max: "2" },
        },
      },
    ];

    for (const changedManifest of changedManifests) {
      expect(isSameLearningArtifactManifest(manifest, changedManifest)).toBe(
        false
      );
    }
  });

  it("fails manifest building when transcript metadata exceeds budgets", async () => {
    const exit = await Effect.runPromiseExit(
      buildLearningArtifactManifest(
        coordinateArtifact({
          title: "x".repeat(181),
        })
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("drops blank descriptions from transcript manifests", async () => {
    const manifest = await Effect.runPromise(
      buildLearningArtifactManifest(coordinateArtifact({ description: "   " }))
    );

    expect(manifest.description).toBeUndefined();
  });

  it("encodes artifact writes into Convex transport data", async () => {
    const encoded = await Effect.runPromise(
      encodeLearningArtifactWrite({
        artifact: coordinateArtifact({ id: "artifact-write-1" }),
        partOrder: 2,
      })
    );

    expect(encoded).toMatchObject({
      artifact: { id: "artifact-write-1" },
      partOrder: 2,
    });
  });

  it("rejects invalid artifact writes before Convex transport", async () => {
    const exit = await Effect.runPromiseExit(
      encodeLearningArtifactWrite({
        artifact: { id: " " },
        partOrder: 0,
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

/** Creates the minimal coordinate artifact accepted by manifest tests. */
function coordinateArtifact({
  description,
  id = "artifact-manifest-3",
  title = "Coordinate artifact",
}: {
  readonly description?: string;
  readonly id?: string;
  readonly title?: string;
} = {}) {
  return {
    ...(description ? { description } : {}),
    id,
    kind: "coordinate-system-3d",
    payload: {
      axes: {
        x: [scalar("-1"), scalar("1")],
        y: [scalar("-1"), scalar("1")],
        z: [scalar("-1"), scalar("1")],
      },
      primitives: [
        {
          id: "origin",
          kind: "point",
          point: point("0", "0", "0"),
        },
      ],
      sampling: {
        curveSamples: 16,
        surfaceCells: 8,
      },
    },
    proofAnchors: ["cas://artifact/origin"],
    title,
  } satisfies LearningArtifact;
}

/** Creates a 3D exact point fixture through the artifact Interface. */
function point(x: string, y: string, z: string) {
  return { x: scalar(x), y: scalar(y), z: scalar(z) };
}

/** Creates an exact scalar fixture with display metadata only. */
function scalar(expression: string) {
  return { expression, latex: expression };
}
