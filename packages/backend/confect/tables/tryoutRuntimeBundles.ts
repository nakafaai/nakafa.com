import { Table } from "@confect/core";
import { Schema } from "effect";
export default Table.make(() =>
  Schema.Struct({
    bundleHash: Schema.String,
    bundleJson: Schema.String,
    /** Mutable cleanup owner, absent only after explicit snapshot handoff. */
    cleanupReleaseId: Schema.optionalKey(Schema.String),
    createdAt: Schema.Finite,
    rendererJson: Schema.String,
    rendererManifestHash: Schema.String,
    snapshotId: Schema.String,
    sourceGitSha: Schema.String,
    sourceManifestHash: Schema.String,
    sourceReleaseId: Schema.String,
  })
)
  .index("by_bundleHash", ["bundleHash"])
  .index("by_cleanupReleaseId", ["cleanupReleaseId"])
  .index("by_sourceReleaseId", ["sourceReleaseId"])
  .index("by_snapshotId_and_rendererManifestHash", [
    "snapshotId",
    "rendererManifestHash",
  ]);
