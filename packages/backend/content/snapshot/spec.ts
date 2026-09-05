import { Schema } from "effect";
export const SnapshotHashSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))
);
export const SnapshotMetadataSchema = Schema.Struct({
  runtimeSelectionHash: SnapshotHashSchema,
  runtimeSchemaFingerprint: SnapshotHashSchema,
});

export type SnapshotIdentity = typeof SnapshotMetadataSchema.Type;
export type RuntimeSelectionIdentity = Pick<
  SnapshotIdentity,
  "runtimeSelectionHash"
>;

export const CONTENT_SERVING_DESCRIPTOR_FILE = "snapshot.json";
export const CONTENT_SERVING_DATA_FILE = "data.json";
