import { ContentSnapshotRowSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import { Effect, Schema } from "effect";

/** Strictly decodes current snapshot rows stored by the active publication contract. */
export const decodeStoredSnapshotRow = Effect.fn(
  "contentRelease.decodeStoredSnapshotRow"
)((input: unknown) =>
  Schema.decodeUnknownEffect(ContentSnapshotRowSchema, {
    onExcessProperty: "error",
  })(input)
);
