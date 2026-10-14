import { toModelMessage } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  consumeAttachments,
  requireStoredDocumentLimit,
} from "@repo/backend/confect/nina/attachments";
import { resolveNinaContext } from "@repo/backend/confect/nina/context";
import type { NinaPage } from "@repo/backend/confect/nina/contract/turn";
import {
  type NinaInput,
  type NinaPageInput,
  NinaTurnError,
} from "@repo/backend/confect/nina/turns.spec";
import { cleanSlug } from "@repo/utilities/slug";
import type { ModelMessage } from "ai";
import { Effect } from "effect";

const retryUnavailable = () =>
  new NinaTurnError({
    code: "NINA_RETRY_UNAVAILABLE",
    message: "This message is no longer available to retry.",
  });

/** Whether a retry comes from the page its turn was asked on. */
function isAskedPage(page: NinaPage, input: typeof NinaPageInput.Type) {
  return page.locale === input.locale && page.slug === cleanSlug(input.slug);
}

/**
 * Browser input never owns stored file URLs or the prompt reused by a retry.
 * A retry names the page the learner retries from, like a new message. One
 * from the page its turn was asked on, or from a browser tab that sends no
 * page, keeps that turn's own context, with its placement and question focus.
 * `retryOf` names the turn that first asked the retried question, so every
 * asking of one question carries one key.
 */
export const preparePrompt = Effect.fn("nina.prompt.prepare")(function* (
  user: Docs["users"],
  chat: Docs["chats"] | null,
  input: typeof NinaInput.Type
) {
  if (input.kind === "message") {
    const context = yield* resolveNinaContext(input.page, user, chat?._id);
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
      retryOf: undefined,
    };
  }
  if (!chat) {
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
  const fileIds = stored.fileIds ?? [];
  yield* requireStoredDocumentLimit(fileIds);
  const retryOf = original.retryOf ?? original.order;
  const asked =
    original.page && original.user
      ? { page: original.page, user: original.user }
      : undefined;
  if (asked && (!input.page || isAskedPage(asked.page, input.page))) {
    return { ...asked, fileIds, message, retryOf };
  }
  if (!input.page) {
    return yield* retryUnavailable();
  }
  return {
    ...(yield* resolveNinaContext(input.page, user, chat._id)),
    fileIds,
    message,
    retryOf,
  };
});
