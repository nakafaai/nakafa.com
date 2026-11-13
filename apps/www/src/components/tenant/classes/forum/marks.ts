import { threadTitle } from "@repo/backend/confect/classroom/forum/thread";
import { Array as Arr, Duration, Option, Order, String as Str } from "effect";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";

/** How long after a message the same author's next one still joins its run, as Slack and Discord group a burst. */
const RUN_GAP = Duration.minutes(5);

/** The most emoji a message of emoji alone holds and still shows them large, as chat apps do. */
const JUMBO_LIMIT = 3;

/** One emoji: a pictograph or a flag's letters, with whatever joins or colours it. */
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** The whitespace between the emoji of a message. */
const SPACES = /\s+/gu;

/** What splits a text into the characters a reader sees, whatever code points each one joins. */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: "grapheme" });

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
 * Whether the loaded messages, oldest first, show where the unread ones start: nothing is unread, the message
 * before the first unread one is loaded, or the place holds nothing `older`. Until then the place reads older
 * messages before it opens, so it opens at its first unread message, never at the oldest one it happened to load.
 */
export const showsUnreadStart = (
  messages: readonly ForumMessage[],
  at: number | null,
  older: boolean
) =>
  !older ||
  Option.match(firstUnread(messages, at), {
    onNone: () => true,
    onSome: (key) =>
      Option.exists(Arr.head(messages), (first) => first.clientKey !== key),
  });

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
 * Whether a message opens a run, which shows its author's face and name: the
 * oldest loaded, one after another author's, one written more than five minutes
 * after the message before it, one that opens a discussion, or one that once stood
 * oldest and keeps its line.
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
          previous.author.nina !== message.author.nina ||
          previous.discussion !== null ||
          message.createdAt - previous.createdAt > Duration.toMillis(RUN_GAP) ||
          Arr.contains(kept, message.clientKey)
      ),
  });

/**
 * Whether a message opens a discussion with a title of its own, as a teacher's
 * question does, rather than a thread of the message whose first line is its
 * title. Only a titled discussion shows its title above its message, which would
 * otherwise repeat the message's own words.
 */
export const isTitled = (message: ForumMessage) =>
  message.discussion !== null &&
  message.discussion.title !== threadTitle(message);

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

/**
 * Whether a message holds one to three emoji and nothing else, which the chat shows large and without a bubble, as
 * WhatsApp and Slack do. Each character a reader sees must be an emoji: digits, letters and marks keep the bubble.
 */
export const isJumbo = (text: string | null) => {
  if (text === null) {
    return false;
  }
  const graphemes = Arr.map(
    Arr.fromIterable(GRAPHEMES.segment(Str.replace(SPACES, "")(text))),
    (part) => part.segment
  );
  return (
    graphemes.length > 0 &&
    graphemes.length <= JUMBO_LIMIT &&
    Arr.every(graphemes, (grapheme) =>
      Option.isSome(Str.match(EMOJI_GRAPHEME)(grapheme))
    )
  );
};
