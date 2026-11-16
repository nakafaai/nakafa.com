import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { cva } from "class-variance-authority";
import { Array as Arr, DateTime } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  MessageMenu,
  MessageToolbar,
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

/** The row of one message: its hover look, the selected look of an open thread's message, and the room above a run. */
const messageRow = cva(
  "group/row pointer-fine:hover:bg-muted/40 data-selected:bg-muted/70 rounded-2xl px-2 py-1 transition-colors outline-none data-opens:mt-3"
);

/**
 * One message of a channel or of a thread, laid out with shadcn's Message and Bubble (ADR 0025): the header row with
 * the author's name and the time above the bubble, the face beside the header as Slack and Discord place it, the
 * reactions and the thread's summary under the bubble, and a footer that says it was edited. A run by one author
 * shows its face and header once, on its first message (`opens`), so a burst reads as one block. The viewer's own
 * messages stand at the end of the row. The message's actions float in one toolbar over the row's top corner on hover, on
 * focus, and on a tap. In a channel, only a titled discussion shows its title, since a thread of a message would repeat
 * the message's own words, and the message whose thread stands open keeps its selected look.
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
    // A tap focuses the row, which shows its toolbar on a touch screen, where no hover exists.
    <Message
      align={message.mine ? "end" : "start"}
      className={messageRow()}
      data-opens={opens ? "" : undefined}
      data-selected={selected && discussion !== null ? "" : undefined}
      tabIndex={-1}
    >
      {opens ? (
        <MessageAvatar className="translate-y-0 self-start bg-transparent">
          <ForumFace face={message.author} />
        </MessageAvatar>
      ) : (
        <MessageAvatar aria-hidden="true" className="bg-transparent" />
      )}
      <MessageContent>
        {opens ? <MessageHead message={message} /> : null}
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
        {message.text !== null && message.editedAt !== null ? (
          <EditedFooter />
        ) : null}
      </MessageContent>
    </Message>
  );
}

/**
 * The header row of a run: the author's name, or Nina's for her replies, broken anywhere when it is long, and when the
 * run began, as the reader's clock shows it, with the whole date on hover and for assistive technology.
 */
function MessageHead({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const written = DateTime.toDateUtc(DateTime.makeUnsafe(message.createdAt));

  return (
    <MessageHeader className="flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-foreground font-semibold wrap-anywhere" dir="auto">
        {message.author.nina ? t("nina-author") : message.author.name}
      </span>
      <time
        className="font-normal tabular-nums"
        dateTime={written.toISOString()}
        title={format.dateTime(written, "full")}
      >
        {format.dateTime(written, "time")}
      </time>
    </MessageHeader>
  );
}

/** The footer of a message its author changed after sending it. */
function EditedFooter() {
  const t = useTranslations("Classroom");

  return <MessageFooter>{t("message-edited")}</MessageFooter>;
}

/**
 * The message itself: its poll or its bubble, with the toolbar of its actions, or the edit field the viewer's own
 * message turns into in place.
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
    <>
      <MessagePoll message={message} />
      {message.text === "" ? null : <MessageBubble message={message} />}
      {message.text === null ? null : (
        <MessageToolbar message={message}>
          <MessageMenu message={message} onEdit={() => setEditing(true)} />
        </MessageToolbar>
      )}
    </>
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
 * another member's. A word or an address too long for the row breaks where it must. A message a teacher hid keeps its
 * place with a sentence that says so.
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
      </BubbleContent>
    </Bubble>
  );
}
