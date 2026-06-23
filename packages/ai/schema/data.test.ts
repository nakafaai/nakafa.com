import { LearningArtifactManifestSchema } from "@repo/ai/schema/data";
import { MAX_COORDINATE_ARTIFACT_BYTES } from "@repo/math/schema/artifact/safety";
import { Schema } from "effect";
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
});
