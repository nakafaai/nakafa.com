import type { MessageDoc } from "@convex-dev/agent/validators";
import { readAddress } from "@repo/backend/confect/bucket/file";
import { objectKeyOf } from "@repo/backend/confect/bucket/sign";
import { Effect, Option, String as Str } from "effect";

/** A learner's stored message, the only kind that carries the files the learner sent. */
type UserMessage = Extract<
  NonNullable<MessageDoc["message"]>,
  { role: "user" }
>;

/** One stored part of a learner's message. */
type UserPart = Exclude<UserMessage["content"], string>[number];

/** What a stored image or file part holds: bytes, an address, or a provider's own reference. */
type PartData =
  | Extract<UserPart, { type: "file" }>["data"]
  | Extract<UserPart, { type: "image" }>["image"];

/** The query field every presigned address carries, so an address without it is never the bucket's. */
const isPresigned = Str.includes("X-Amz-Signature=");

/**
 * The data of one stored part, signed again when it is an address of the bucket, so a part sent hours ago reads its
 * file at an address that is live now. Bytes and any other address stay as they are, and read no setting.
 */
const freshData = Effect.fn("nina.files.data")(function* (data: PartData) {
  if (typeof data !== "string" || !isPresigned(data)) {
    return data;
  }
  const key = yield* objectKeyOf(data);
  return Option.isNone(key) ? data : yield* readAddress(key.value);
});

/** One stored part with its file, when it holds one, at a fresh address. */
const freshPart = Effect.fn("nina.files.part")(function* (part: UserPart) {
  if (part.type === "image") {
    return { ...part, image: yield* freshData(part.image) };
  }
  if (part.type === "file") {
    return { ...part, data: yield* freshData(part.data) };
  }
  return part;
});

/**
 * One opened message row with every file a learner sent at an address signed now (ADR 0028). A sealed row keeps the
 * address its part was sent with, which expires; each read of the row, by a turn or by the page, signs it again.
 */
export const freshRow = Effect.fn("nina.files.row")(function* (
  row: MessageDoc
) {
  const message = row.message;
  if (message?.role !== "user" || typeof message.content === "string") {
    return row;
  }
  const content = yield* Effect.forEach(message.content, freshPart);
  return { ...row, message: { ...message, content } };
});
