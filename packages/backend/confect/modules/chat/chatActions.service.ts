import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import type {
  MessagePartInput,
  MessageRole,
  ModelId,
} from "@repo/backend/confect/modules/chat/chats.tables";
import { requireAppUserForAction } from "@repo/backend/confect/modules/identity/auth/action.service";
import { Duration, Effect } from "effect";

interface ChatMessageInput {
  readonly chatId: Id<"chats">;
  readonly credits?: number;
  readonly identifier: string;
  readonly inputTokens?: number;
  readonly modelId?: ModelId;
  readonly outputTokens?: number;
  readonly role: MessageRole;
  readonly totalTokens?: number;
}

/** Schedules assistant response persistence for the current user. */
export const scheduleSaveAssistantResponse = Effect.fn(
  "chatActions.scheduleSaveAssistantResponse"
)(function* (args: {
  message: ChatMessageInput;
  parts: readonly MessagePartInput[];
}) {
  const scheduler = yield* Scheduler;
  const { appUser } = yield* requireAppUserForAction();

  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.chats.mutations.saveAssistantResponse,
    { userId: appUser._id, ...args }
  );

  return null;
});
