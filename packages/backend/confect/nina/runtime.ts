import { NinaFileType } from "@repo/backend/client/nina/uploads";
import refs from "@repo/backend/confect/_generated/refs";
import type { ModelMessage } from "ai";
import { Array as Arr, Schema } from "effect";

/**
 * Whether a media type is a document: a file type that Nina accepts and that is
 * not an image. Images travel as URLs, so only the documents need the Node
 * runtime. The list is `NinaFileType`, never a second copy of it.
 */
const isDocumentType = (mediaType: string) =>
  Schema.is(NinaFileType)(mediaType) && !mediaType.startsWith("image/");

/** One part of a message's content, whatever the role of the message. */
type ContentPart = Exclude<ModelMessage["content"], string>[number];

/** Whether a message carries at least one document part. */
const carriesDocument = (message: ModelMessage) =>
  typeof message.content !== "string" &&
  Arr.some(
    Arr.fromIterable<ContentPart>(message.content),
    (part) => part.type === "file" && isDocumentType(part.mediaType)
  );

/**
 * The run that answers the turn of a message. A message with a document runs
 * in the Node runtime, which reads the document in memory (`nina/documents`).
 * Every other message, images included, runs in the default runtime, which has
 * no cold start (`nina/response`). ADR 0019 holds the measurements.
 */
export const answerRunFor = (message: ModelMessage) =>
  carriesDocument(message)
    ? refs.internal.nina.documents.run
    : refs.internal.nina.response.run;
