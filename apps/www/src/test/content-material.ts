import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { Array as Arr, Schema } from "effect";
import {
  previewWireArtifact as artifact,
  previewDeProjection as deProjection,
  previewIdProjection as idProjection,
  previewProjection as projection,
  previewSourcePath as sourcePath,
} from "@/test/content-preview";

/** The material publication that the lesson tests verify and render. */
export const activeReleaseId = ReleaseIdSchema.make("release-material");
const encodeProjection = Schema.encodeSync(
  Schema.fromJsonString(MaterialLessonProjectionSchema)
);
export const model = {
  activeReleaseId,
  activeAppLocales: ["en", "id", "de"],
  alternateJson: Arr.map([projection, idProjection, deProjection], (value) =>
    encodeProjection(value)
  ),
  projectionJson: encodeProjection(projection),
  activeManifestHash: `sha256:${"a".repeat(64)}`,
  rendererDomain: "mathematics",
  siblingJson: [encodeProjection(projection)],
  sourcePath,
  sourceRevision: "a".repeat(40),
};
export const data = {
  activeReleaseId,
  artifact,
  projection,
  sourcePath,
  sourceRevision: "a".repeat(40),
  rendererManifest: {},
};
export const published = {
  activeReleaseId,
  artifactHash: artifact.artifactHash,
  projection,
  body: "rendered",
};
