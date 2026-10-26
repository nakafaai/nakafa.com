import { Array as Arr, Option } from "effect";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";

/** Whether a message is only on the page while the server saves it: its ID is still its client key. */
export const isPending = (message: ForumMessage) =>
  message.id === message.clientKey;

/**
 * The client key of the first message, oldest first, that another member wrote
 * after the read mark `at`, where the unread divider goes and the place opens. A
 * place the viewer never read has no divider and opens at its newest edge.
 */
export const firstUnread = (
  messages: readonly ForumMessage[],
  at: number | null
) =>
  at === null
    ? Option.none()
    : Option.map(
        Arr.findFirst(
          messages,
          (message) => !message.mine && message.createdAt > at
        ),
        (message) => message.clientKey
      );

/**
 * The time of the newest message the reader has in view, which the read mark moves
 * to. A message the server is still saving is left out, because its time is the
 * browser's.
 */
export const newestSeen = (
  messages: readonly ForumMessage[],
  visible: readonly string[]
) =>
  Arr.match(
    Arr.filter(
      messages,
      (message) =>
        !isPending(message) && Arr.contains(visible, message.clientKey)
    ),
    {
      onEmpty: () => Option.none(),
      onNonEmpty: (seen) =>
        Option.some(Arr.max(Arr.map(seen, (message) => message.createdAt))),
    }
  );
