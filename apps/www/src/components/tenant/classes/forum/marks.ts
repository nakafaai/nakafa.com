import { Array as Arr, Option, Order } from "effect";
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
        Option.some(
          Arr.max(
            Arr.map(seen, (message) => message.createdAt),
            Order.Number
          )
        ),
    }
  );

/**
 * The client key of the oldest loaded message while older history may still
 * load, when the stream does not keep its author line yet. Once kept, the line
 * stays when the older page arrives, so the message the reader looks at does not
 * move by the height of that line.
 */
export const headToKeep = (
  messages: readonly ForumMessage[],
  older: boolean,
  kept: readonly string[]
) =>
  older
    ? Option.filter(
        Option.map(Arr.head(messages), (message) => message.clientKey),
        (key) => !Arr.contains(kept, key)
      )
    : Option.none();

/**
 * Whether a message shows its author's line: the oldest loaded, one after
 * another author's, or one that once stood oldest and keeps its line.
 */
export const opensRun = (
  messages: readonly ForumMessage[],
  index: number,
  kept: readonly string[]
) =>
  Option.match(Arr.get(messages, index - 1), {
    onNone: () => true,
    onSome: (previous) =>
      Option.exists(
        Arr.get(messages, index),
        (message) =>
          previous.author.id !== message.author.id ||
          Arr.contains(kept, message.clientKey)
      ),
  });

/**
 * The day a message opens, which a divider shows above it: the reader's day of the message
 * (`dayOf`) when the message before it, or the discussion's opening message before the oldest
 * reply, was written on another day. The oldest loaded message shows none while older history may
 * still load, so the page that arrives above it never moves it.
 */
export const opensDay = (
  messages: readonly ForumMessage[],
  index: number,
  older: boolean,
  opening: Option.Option<ForumMessage>,
  dayOf: (time: number) => string
) =>
  index === 0 && older
    ? Option.none()
    : Option.flatMap(Arr.get(messages, index), (message) => {
        const day = dayOf(message.createdAt);
        const before = index === 0 ? opening : Arr.get(messages, index - 1);
        return Option.exists(
          before,
          (previous) => dayOf(previous.createdAt) === day
        )
          ? Option.none()
          : Option.some(day);
      });
