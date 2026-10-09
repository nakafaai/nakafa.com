import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** Committed prompt presentation used while the first reactive page arrives. */
const NinaPromptPreview = Schema.Struct({
  text: Schema.String,
  files: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        type: Schema.Literal("file"),
        url: Schema.String,
        mediaType: Schema.String,
        filename: Schema.optional(Schema.String),
      })
    )
  ),
});

export const NinaReceipt = Schema.Struct({
  prompt: NinaPromptPreview,
  chatId: Id("chats"),
  threadId: Schema.String,
  turnId: Id("ninaTurns"),
  promptMessageId: Schema.String,
  order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
