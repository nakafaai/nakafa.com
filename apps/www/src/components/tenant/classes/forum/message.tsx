import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { cva } from "class-variance-authority";
import { Array as Arr, DateTime } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  MessageActions,
  MessageMenu,
} from "@/components/tenant/classes/forum/actions";
import { MessageEditor } from "@/components/tenant/classes/forum/editor";
import { ForumFace } from "@/components/tenant/classes/forum/face";
import { isJumbo, isTitled } from "@/components/tenant/classes/forum/marks";
import { MessageMedia } from "@/components/tenant/classes/forum/media";
import { mentionSegments } from "@/components/tenant/classes/forum/mentions";
import { useIsOpenRoot } from "@/components/tenant/classes/forum/open";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { MessagePoll } from "@/components/tenant/classes/forum/poll";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import {
  DiscussionTitle,
  ThreadSummary,
} from "@/components/tenant/classes/forum/summary";
import { MessageReactions } from "@/components/tenant/classes/forum/tallies";

/**
 * One message of a channel or of a thread, as a chat app shows it (ADR 0025). The first message of a run by one
 * author (`opens`) shows the author's face and name, and the rest of the run keep the face's column empty, so a burst
 * reads as one block. The viewer's own messages stand at the end of the row, with their face at the end. Its photos
 * and documents stand above its text, and its poll in the text's place. The time sits inside the bubble, the emoji
 * under it, and the message's actions beside it on hover or focus. In a channel, a titled discussion shows its title
 * above its message, and a thread shows its summary under it; while the thread stands open, the message keeps its
 * selected look. The viewer's own message turns into its edit field in place.
 */
export function ForumMessageRow({
  message,
  opens,
}: {
  message: ForumMessage;
  opens: boolean;
}) {
  const scope = useChannelScope();
  const selected = useIsOpenRoot(message.clientKey);
  // Inside its own thread the opening message needs no summary: the thread is the pane.
  const discussion = scope.discussion === undefined ? message.discussion : null;

  return (
    <Message
      align={message.mine ? "end" : "start"}
      className="group/row pointer-fine:hover:bg-muted/40 data-selected:bg-muted/70 rounded-2xl px-1.5 py-1 transition-colors data-opens:mt-3"
      data-opens={opens ? "" : undefined}
      data-selected={selected && discussion !== null ? "" : undefined}
    >
      {opens ? (
        <MessageAvatar className="self-start bg-transparent">
          <ForumFace face={message.author} />
        </MessageAvatar>
      ) : (
        <MessageAvatar aria-hidden="true" className="bg-transparent" />
      )}
      <MessageContent className="gap-1.5">
        {opens ? <AuthorName message={message} /> : null}
        {discussion !== null && isTitled(message) ? (
          <DiscussionTitle discussion={discussion} message={message} />
        ) : null}
        <MessageMedia message={message} />
        <MessageMain message={message} />
        <MessageReactions message={message} />
        {discussion !== null &&
        (discussion.replies > 0 || isTitled(message)) ? (
          <ThreadSummary discussion={discussion} message={message} />
        ) : null}
      </MessageContent>
    </Message>
  );
}

/** The author's name at the start of a run, or Nina's for her replies, broken anywhere when it is long. */
function AuthorName({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");

  return (
    <MessageHeader
      className="text-foreground block px-1 font-semibold wrap-anywhere"
      dir="auto"
    >
      {message.author.nina ? t("nina-author") : message.author.name}
    </MessageHeader>
  );
}

/**
 * The message itself: its poll, its bubble and its actions in one row, or the edit field the viewer's own message
 * turns into in place.
 */
function MessageMain({ message }: { message: ForumMessage }) {
  const [editing, setEditing] = useState(false);

  if (editing && message.text !== null) {
    return (
      <MessageEditor
        message={message}
        onDone={() => setEditing(false)}
        text={message.text}
      />
    );
  }
  return (
    // The actions stand on the bubble's inner side: before the viewer's own, after another's.
    <div
      className="flex w-full min-w-0 items-center gap-1 data-[mine=true]:flex-row-reverse"
      data-mine={message.mine}
    >
      <MessagePoll message={message} />
      {message.text === "" ? (
        <MessageTime message={message} />
      ) : (
        <MessageBubble message={message} />
      )}
      {message.text === null ? null : (
        <MessageActions message={message}>
          <MessageMenu message={message} onEdit={() => setEditing(true)} />
        </MessageActions>
      )}
    </div>
  );
}

/** The text of a bubble: a hidden message's sentence in italics, emoji alone large on no surface, else the text. */
const bubbleText = cva("", {
  variants: {
    hidden: { false: "wrap-anywhere whitespace-pre-wrap", true: "italic" },
    jumbo: {
      false: "",
      true: "text-foreground! bg-transparent! px-0 text-4xl leading-tight",
    },
  },
});

/**
 * The body of a message: its text on the secondary surface for the viewer's own message, and on the muted one for
 * another member's, with its time, and that it was edited, at the bubble's end. A word or an address too long for the
 * row breaks where it must. A message a teacher hid keeps its place with a sentence that says so.
 */
function MessageBubble({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const own = message.mine && message.text !== null;

  return (
    <Bubble
      align={message.mine ? "end" : "start"}
      variant={own ? "secondary" : "muted"}
    >
      <BubbleContent
        className={bubbleText({
          hidden: message.text === null,
          jumbo: isJumbo(message.text),
        })}
        dir="auto"
      >
        {message.text === null
          ? t("message-hidden")
          : Arr.map(
              mentionSegments(message.text, message.mentions),
              (segment) =>
                segment._tag === "mention" ? (
                  <bdi className="font-semibold" key={segment.at}>
                    {segment.text}
                  </bdi>
                ) : (
                  <span key={segment.at}>{segment.text}</span>
                )
            )}
        <MessageTime message={message} />
      </BubbleContent>
    </Bubble>
  );
}

/**
 * When a message was written, as the reader's clock shows it, with the whole date on hover and for assistive
 * technology, and that it was edited. The day stands once above the day's first message.
 */
function MessageTime({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const written = DateTime.toDateUtc(DateTime.makeUnsafe(message.createdAt));

  return (
    <span className="mt-1 flex justify-end gap-1.5 text-xs not-italic">
      {message.text !== null && message.editedAt !== null ? (
        <span>{t("message-edited")}</span>
      ) : null}
      <time
        dateTime={written.toISOString()}
        title={format.dateTime(written, {
          dateStyle: "full",
          timeStyle: "short",
        })}
      >
        {format.dateTime(written, { timeStyle: "short" })}
      </time>
    </span>
  );
}
