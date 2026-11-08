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

/**
 * The steps after a document's snapshot do not reach its head, so the document as it stands
 * now cannot be read (ADR 0028). A reader of the current text, such as a student's paper or a
 * copy of a question, refuses it rather than show text older than the last edit. A submit
 * answers its own backlog with the `FoldPending` reply instead (`SubmitReply`), because the
 * editor's sync decides that outcome for itself. The server writes nothing.
 */
export class FoldPending extends Schema.TaggedError<FoldPending>()(
  "FoldPending",
  refusal(
    "FOLD_PENDING",
    "The steps of this document are being folded. Read it again shortly."
  )
) {}

/** A batch of steps that is not JSON, or that the step schema refuses. It names no part of the batch. */
export class BatchInvalid extends Schema.TaggedError<BatchInvalid>()(
  "BatchInvalid",
  refusal("BATCH_INVALID", "This batch of steps is not one the editor accepts.")
) {}
