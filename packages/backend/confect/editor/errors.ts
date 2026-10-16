import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/**
 * Why the server refuses a snapshot: its version is no newer than the stored
 * snapshot (`stale`), it is past the head (`ahead`), or the snapshot rule does not
 * allow a snapshot yet (`notDue`).
 */
const SnapshotReason = Schema.Literals(["ahead", "notDue", "stale"]);

/** A snapshot the server refuses for the rule it breaks. It writes nothing. */
export class SnapshotRefused extends Schema.TaggedError<SnapshotRefused>()(
  "SnapshotRefused",
  {
    reason: SnapshotReason,
    ...refusal(
      "SNAPSHOT_REFUSED",
      "The editor cannot save this version of the document now."
    ),
  }
) {}

/** A batch of steps that is not JSON, or that the step schema refuses. It names no part of the batch. */
export class BatchInvalid extends Schema.TaggedError<BatchInvalid>()(
  "BatchInvalid",
  refusal("BATCH_INVALID", "This batch of steps is not one the editor accepts.")
) {}
