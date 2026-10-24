import { createServerFn } from "@tanstack/react-start";
import { Schema } from "effect";
import { ReaderChatRequest, ReaderPageRequest } from "@/lib/chat/reader";

export const readerHandler = async ({
  data,
}: {
  readonly data: typeof ReaderChatRequest.Type;
}) => {
  const { readReaderHandler } = await import("@/lib/chat/reader.server");
  return readReaderHandler({ data });
};

/**
 * The first page of a shared chat, read on the server with the token its link
 * carries. The token travels in the body of the request, never in its address.
 */
export const readReaderFn = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReaderChatRequest))
  .handler(readerHandler);

export const readerOlderHandler = async ({
  data,
}: {
  readonly data: typeof ReaderPageRequest.Type;
}) => {
  const { readReaderOlderHandler } = await import("@/lib/chat/reader.server");
  return readReaderOlderHandler({ data });
};

/** One older page of a shared chat, for the reader who holds the token of its link. */
export const readReaderOlderFn = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ReaderPageRequest))
  .handler(readerOlderHandler);
