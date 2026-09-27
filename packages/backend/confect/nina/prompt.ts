import { toModelMessage } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { consumeAttachments } from "@repo/backend/confect/nina/attachments";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import {
  type NinaInput,
  NinaTurnError,
} from "@repo/backend/confect/nina/turns.spec";
import type { ModelMessage } from "ai";
import { Effect, type Schema } from "effect";

const retryUnavailable = () =>
  new NinaTurnError({
    code: "NINA_RETRY_UNAVAILABLE",
    message: "This message is no longer available to retry.",
  });

/** Browser input never owns stored file URLs or the prompt reused by a retry. */
export const preparePrompt = Effect.fn("nina.prompt.prepare")(function* (
  user: Docs["users"],
  chat: Docs["chats"] | null,
  input: Schema.Schema.Type<typeof NinaInput>,
  capturedAt: string
) {
  if (input.kind === "message") {
    const context = yield* resolveNinaContext(
      input.page,
      user,
      capturedAt,
      chat?._id
    );
    const attachments = yield* consumeAttachments(
      user._id,
      input.prompt.uploadIds ?? []
    );
    return {
      ...context,
      fileIds: attachments.fileIds,
      message: {
        role: "user",
        content: [
          { type: "text", text: input.prompt.text },
          ...attachments.parts,
        ],
      } satisfies ModelMessage,
    };
  }
  if (!chat?.threadId) {
    return yield* retryUnavailable();
  }
  const original = yield* (yield* DatabaseReader)
    .table("ninaTurns")
    .get("by_chatId_and_order", chat._id, input.order)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (
    !original ||
    original.userId !== user._id ||
    original.threadId !== chat.threadId
  ) {
    return yield* retryUnavailable();
  }
  const ctx = yield* MutationCtx;
  const [stored] = yield* Effect.tryPromise({
    try: () =>
      ctx.runQuery(components.nina.messages.getMessagesByIds, {
        messageIds: [original.promptMessageId],
      }),
    catch: retryUnavailable,
  });
  if (
    !stored ||
    stored.threadId !== chat.threadId ||
    stored.userId !== user._id ||
    stored.message?.role !== "user"
  ) {
    return yield* retryUnavailable();
  }
  const originalMessage = stored.message;
  const message = yield* Effect.try({
    try: () => toModelMessage(originalMessage),
    catch: retryUnavailable,
  });
  if (!(original.page && original.user)) {
    if (!input.page) {
      return yield* retryUnavailable();
    }
    return {
      message,
      fileIds: stored.fileIds ?? [],
      ...(yield* resolveNinaContext(input.page, user, capturedAt, chat._id)),
    };
  }
  return {
    message,
    fileIds: stored.fileIds ?? [],
    page: original.page,
    user: original.user,
  };
});
