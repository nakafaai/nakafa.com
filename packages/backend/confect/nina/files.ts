import type { MessageDoc } from "@convex-dev/agent/validators";
import { readAddress } from "@repo/backend/confect/bucket/file";
import { objectKeyOf } from "@repo/backend/confect/bucket/sign";
import { Effect, Option } from "effect";

/**
 * The data of one stored part, signed again when it is an address of the bucket, so a part sent hours ago reads its
 * file at an address that is live now. Bytes and any other address stay as they are.
 */
const freshData = Effect.fn("nina.files.data")(function* <A>(data: A) {
  if (typeof data !== "string") {
    return data;
  }
  const key = yield* objectKeyOf(data);
  return Option.isNone(key) ? data : yield* readAddress(key.value);
});

/**
 * One opened message row with every file a learner sent at an address signed now (ADR 0028). A sealed row keeps the
 * address its part was sent with, which expires; each read of the row, by a turn or by the page, signs it again.
 */
export const freshRow = Effect.fn("nina.files.row")(function* (
  row: MessageDoc
) {
  const message = row.message;
  if (message === undefined || typeof message.content === "string") {
    return row;
  }
  const content = yield* Effect.forEach(message.content, (part) => {
    if (part.type === "image") {
      return Effect.map(freshData(part.image), (image) => ({
        ...part,
        image,
      }));
    }
    if (part.type === "file") {
      return Effect.map(freshData(part.data), (data) => ({ ...part, data }));
    }
    return Effect.succeed(part);
  });
  return { ...row, message: { ...message, content } };
});
