import { Ref } from "@confect/core";
import type { MyUIMessagePart } from "@repo/ai/types/message";
import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUserForAction } from "@repo/backend/confect/modules/identity/auth.service";
import { Effect } from "effect";

interface ChatMessageInput {
  readonly chatId: Id<"chats">;
  readonly credits?: number;
  readonly identifier: string;
  readonly inputTokens?: number;
  readonly modelId?: "nakafa-lite" | "nakafa-pro";
  readonly outputTokens?: number;
  readonly role: "user" | "assistant" | "system";
  readonly totalTokens?: number;
}

/** Schedules assistant response persistence for the current user. */
export const scheduleSaveAssistantResponse = Effect.fn(
  "chatActions.scheduleSaveAssistantResponse"
)(function* (args: {
  message: ChatMessageInput;
  parts: readonly MyUIMessagePart[];
}) {
  const ctx = yield* ActionCtx;
  const { appUser } = yield* requireAppUserForAction(ctx);

  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(
      0,
      Ref.getFunctionReference(
        refs.internal.chats.mutations.saveAssistantResponse
      ),
      { userId: appUser._id, ...args }
    )
  );

  return null;
});
