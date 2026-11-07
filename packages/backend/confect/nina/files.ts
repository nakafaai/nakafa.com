import { readAddress } from "@repo/backend/confect/bucket/file";
import { objectKeyOf } from "@repo/backend/confect/bucket/sign";
import type { FilePart, ImagePart, ModelMessage } from "ai";
import { Effect, Option } from "effect";

/** What an image or a file part holds: bytes, or an address. */
type PartData = FilePart["data"] | ImagePart["image"];

/**
 * The data of one part, signed again when it is an address of the bucket, so a part sent hours ago reads its file at
 * an address that is live now. Bytes and any other address stay as they are.
 */
const freshData = Effect.fn("nina.files.data")(function* (data: PartData) {
  if (!(data instanceof URL || typeof data === "string")) {
    return data;
  }
  const key = yield* objectKeyOf(data instanceof URL ? data.href : data);
  return Option.isNone(key) ? data : yield* readAddress(key.value);
});

/**
 * The model messages of a turn with every file a learner sent at an address signed now (ADR 0028). A sealed message
 * keeps the address its part was sent with, which expires; the turn reads each one again here.
 */
export const freshAddresses = Effect.fn("nina.files.fresh")(function* (
  messages: readonly ModelMessage[]
) {
  return yield* Effect.forEach(messages, (message) =>
    message.role !== "user" || typeof message.content === "string"
      ? Effect.succeed(message)
      : Effect.map(
          Effect.forEach(message.content, (part) => {
            if (part.type === "image") {
              return Effect.map(freshData(part.image), (image) => ({
                ...part,
                image,
              }));
            }
            if (part.type === "file") {
              return Effect.map(freshData(part.data), (data) => ({
                ...part,
                data,
              }));
            }
            return Effect.succeed(part);
          }),
          (content): ModelMessage => ({ ...message, content })
        )
  );
});
