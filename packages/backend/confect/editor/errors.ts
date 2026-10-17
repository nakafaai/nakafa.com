import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Schema } from "effect";

/**
 * A batch whose client id belongs to another person's editor session. The server
 * writes nothing, so a co-editor cannot send steps under another editor's id.
 */
export class ClientTaken extends Schema.TaggedError<ClientTaken>()(
  "ClientTaken",
  refusal(
    "CLIENT_TAKEN",
    "This editor session belongs to another person. Open the document again."
  )
) {}

/** A batch of steps that is not JSON, or that the step schema refuses. It names no part of the batch. */
export class BatchInvalid extends Schema.TaggedError<BatchInvalid>()(
  "BatchInvalid",
  refusal("BATCH_INVALID", "This batch of steps is not one the editor accepts.")
) {}
