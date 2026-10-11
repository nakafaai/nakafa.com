import type { NinaMessage } from "@repo/backend/confect/nina/schema";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Option } from "effect";
import type { AiState } from "@/components/ai/store/types";
import type { NinaDraft } from "@/components/ai/submission";

/**
 * The first prompt of a chat the learner just started, built from its receipt.
 * It stands in for the saved message until the Agent feed loads, under the key
 * that message will have, so the row does not remount when the feed arrives.
 */
export function openingMessage(
  opening: NonNullable<AiState["openingChat"]>
): NinaMessage {
  return {
    id: opening.receipt.promptMessageId,
    key: `${opening.receipt.threadId}-${opening.receipt.order}-0`,
    order: opening.receipt.order,
    stepOrder: 0,
    role: "user",
    status: "success",
    text: opening.prompt.text,
    parts: [
      { type: "text", text: opening.prompt.text },
      ...Arr.map(opening.prompt.files, ({ filename, ...file }) => ({
        ...file,
        ...(filename === undefined ? {} : { filename }),
        type: "file" as const,
      })),
    ],
    _creationTime: opening.submittedAt,
  };
}

/**
 * The prompt the learner just sent, pending, in the place and under the key
 * its saved message will have once the Agent feed carries it: the order after
 * the chat's latest turn, or the first order of a chat without one.
 */
export function draftMessage({
  chatId,
  createdAt,
  prompt,
  threadId,
  turnOrder,
}: {
  chatId: Id<"chats">;
  createdAt: number;
  prompt: Pick<NinaDraft, "files" | "text">;
  threadId: string;
  turnOrder: number | undefined;
}): NinaMessage {
  const order = turnOrder === undefined ? 0 : turnOrder + 1;
  return {
    id: `draft-${chatId}`,
    key: `${threadId}-${order}-0`,
    order,
    stepOrder: 0,
    role: "user",
    status: "pending",
    text: prompt.text,
    parts: [
      { type: "text", text: prompt.text },
      ...Arr.map(prompt.files ?? [], ({ file, url }) => ({
        type: "file" as const,
        url,
        filename: file.name,
        mediaType: file.type,
      })),
    ],
    _creationTime: createdAt,
  };
}

/**
 * The messages a chat shows: the saved ones from the Agent feed, the first
 * prompt from its receipt while the feed loads, and the pending prompt until a
 * saved prompt of that turn or a later one arrives.
 */
export function mergeMessages({
  draft,
  loading,
  opening,
  results,
}: {
  draft: NinaMessage | null;
  loading: boolean;
  opening: NonNullable<AiState["openingChat"]> | null;
  results: readonly NinaMessage[];
}) {
  const saved = opening && loading ? [openingMessage(opening)] : results;
  if (
    draft &&
    !Arr.some(
      saved,
      (message) => message.role === "user" && message.order >= draft.order
    )
  ) {
    return Arr.append(saved, draft);
  }
  return saved;
}

/** Whether the transcript already ends with Nina's answer to the turn. */
export function hasReply(
  messages: readonly NinaMessage[],
  order: number | undefined
) {
  return Option.exists(
    Arr.last(messages),
    (message) => message.role === "assistant" && message.order === order
  );
}

/**
 * Whether Nina's answer to the turn failed inside the transcript, where the
 * answer shows its own error.
 */
export function hasFailedReply(
  messages: readonly NinaMessage[],
  order: number | undefined
) {
  return Arr.some(
    messages,
    (message) =>
      message.role === "assistant" &&
      message.order === order &&
      message.status === "failed"
  );
}
