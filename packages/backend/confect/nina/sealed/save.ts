import { saveMessage, serializeMessage } from "@convex-dev/agent";
import { components } from "@repo/backend/confect/_generated/components";
import type { MutationCtx } from "@repo/backend/confect/_generated/services";
import {
  identityOf,
  openMessage,
  sealMessage,
} from "@repo/backend/confect/nina/sealed";
import type { LearnerKeys } from "@repo/backend/confect/vault/keys";
import type { ModelMessage } from "ai";
import { Effect, Schema, Struct } from "effect";

/** The component could not store a learner's message. Nothing of the message is kept. */
class SealedWriteError extends Schema.TaggedError<SealedWriteError>()(
  "SealedWriteError",
  {}
) {}

/**
 * The order that a message saved now opens in its thread: the one after the newest
 * message of the thread, which is the order the Agent allocates to a user message
 * (ADR 0024). The newest message is read across every status and tool flag, as the
 * Agent reads it, so a message written here never shares an order with another.
 */
const nextOrder = Effect.fn("nina.sealed.save.order")(function* (
  ctx: MutationCtx,
  threadId: string
) {
  // A failed read is a defect of the admission, which refuses the send as a whole.
  const newest = yield* Effect.promise(() =>
    ctx.runQuery(components.nina.messages.listMessagesByThreadId, {
      order: "desc",
      paginationOpts: { cursor: null, numItems: 1 },
      threadId,
    })
  );
  return (newest.page[0]?.order ?? -1) + 1;
});

/**
 * Saves a learner's message sealed for the learner who owns its thread, as the first
 * step of a new order, and returns the stored message opened (ADR 0024). The content
 * is sealed before the component stores it, so no plain copy of the message rests in
 * the component. The file ids stay in the clear, as the row keeps them. The caller
 * passes the learner's keys, so one read serves the whole admission.
 */
export const savePrompt = Effect.fn("nina.sealed.save.prompt")(function* (
  ctx: MutationCtx,
  keys: LearnerKeys,
  prompt: {
    readonly fileIds: readonly string[];
    readonly message: ModelMessage;
    readonly threadId: string;
  }
) {
  const owner = keys.userId;
  const { message } = yield* Effect.tryPromise({
    try: () => serializeMessage(ctx, components.nina, prompt.message),
    catch: () => new SealedWriteError(),
  });
  const order = yield* nextOrder(ctx, prompt.threadId);
  const identity = { order, stepOrder: 0, threadId: prompt.threadId };
  const sealed = yield* sealMessage(keys, identity, {
    fileIds: [...prompt.fileIds],
    message,
    status: "success",
  }).pipe(Effect.orDie);
  const saved = yield* Effect.tryPromise({
    try: () =>
      saveMessage(ctx, components.nina, {
        message: sealed.message,
        metadata: Struct.omit(sealed, ["message"]),
        order,
        threadId: prompt.threadId,
        userId: owner,
      }),
    catch: () => new SealedWriteError(),
  });
  const opened = yield* openMessage(
    keys,
    identityOf(saved.message),
    saved.message
  ).pipe(Effect.orDie);
  return { messageId: saved.messageId, message: opened };
});
