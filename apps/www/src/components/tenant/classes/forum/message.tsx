import { useMutation } from "@confect/react";
import {
  BubbleChatIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  TextFontIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MessageText } from "@repo/backend/confect/classroom/forum/message";
import { DiscussionTitle as DiscussionTitleText } from "@repo/backend/confect/classroom/forum/thread";
import {
  Bubble,
  BubbleContent,
} from "@repo/design-system/components/ui/bubble";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useNavigate } from "@tanstack/react-router";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Schema,
  String as Str,
} from "effect";
import { startTransition, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  DiscussionReplies,
  DiscussionTitle,
} from "@/components/tenant/classes/forum/discussion";
import { MessageMedia } from "@/components/tenant/classes/forum/media";
import { mentionSegments } from "@/components/tenant/classes/forum/mentions";
import {
  editUpdate,
  type ForumMessage,
  hideUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { MessagePoll } from "@/components/tenant/classes/forum/poll";
import { renameDiscussionUpdate } from "@/components/tenant/classes/forum/rename";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import {
  MessageReactions,
  ReactButton,
} from "@/components/tenant/classes/forum/tallies";
import { useClassScope } from "@/components/tenant/classes/scope";
import { LineDialog } from "@/components/tenant/line";
import { saveSchool } from "@/components/tenant/settings/save";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

const SOURCE = "components/tenant/classes/forum/message";

/**
 * One message of a channel or of a discussion, as a chat shows it. The viewer's own messages stand
 * at the end of the row, and another member's show the author's name above the first message of a
 * run by the same author (`opens`). Its photos and documents stand above its text, and its poll in
 * the text's place. The time sits inside the bubble, its emoji under it, and the message's actions
 * beside it. A message that opens a discussion shows the discussion's title above it and its replies
 * under it in the channel. The viewer's own message turns into its edit field in place.
 */
export function ForumMessageRow({
  message,
  opens,
}: {
  message: ForumMessage;
  opens: boolean;
}) {
  const t = useTranslations("Classroom");
  const [editing, setEditing] = useState(false);
  const scope = useChannelScope();
  // Inside its own discussion the opening message needs no summary: the discussion is the page.
  const discussion = scope.discussion === undefined ? message.discussion : null;

  return (
    <Message align={message.mine ? "end" : "start"}>
      <MessageContent>
        {message.mine || !(opens || discussion !== null) ? null : (
          <MessageHeader dir="auto">
            {message.author.nina ? t("nina-author") : message.author.name}
          </MessageHeader>
        )}
        {discussion === null ? null : (
          <DiscussionTitle discussion={discussion} message={message} />
        )}
        <MessageMedia message={message} />
        {editing && message.text !== null ? (
          <MessageEditor
            message={message}
            onDone={() => setEditing(false)}
            text={message.text}
          />
        ) : (
          // The menu stands on the bubble's inner side: before the viewer's own, after another's.
          <div
            className="group/row flex w-full min-w-0 items-center gap-1 data-[mine=true]:flex-row-reverse"
            data-mine={message.mine}
          >
            <MessagePoll message={message} />
            {message.text === "" ? (
              <MessageTime message={message} />
            ) : (
              <MessageBubble message={message} />
            )}
            {message.text === null ? null : (
              <MessageActions
                message={message}
                onEdit={() => setEditing(true)}
              />
            )}
          </div>
        )}
        <MessageReactions message={message} />
        {discussion === null ? null : (
          <DiscussionReplies discussion={discussion} message={message} />
        )}
      </MessageContent>
    </Message>
  );
}

/**
 * The body of a message: its text in the author's colour for the viewer's own message, and muted
 * for another member's, with its time, and that it was edited, at the bubble's end. A message a
 * teacher hid keeps its place with a sentence that says so.
 */
function MessageBubble({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const own = message.mine && message.text !== null;

  return (
    <Bubble
      align={message.mine ? "end" : "start"}
      variant={own ? "default" : "muted"}
    >
      <BubbleContent
        className={message.text === null ? "italic" : "whitespace-pre-wrap"}
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
 * When a message was written, as the reader's clock shows it, with the whole date on hover and for
 * assistive technology, and that it was edited. The day stands once above the day's first message.
 */
function MessageTime({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const written = DateTime.toDateUtc(DateTime.makeUnsafe(message.createdAt));

  return (
    <span className="mt-1 flex justify-end gap-1.5 text-xs not-italic opacity-70">
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

/**
 * The menu of a message: Edit on the viewer's own message, Hide for whoever manages the forum, and
 * Rename on the message that opens a discussion, for whoever opened it or a teacher who writes in
 * the class, as the server allows.
 */
function MessageActions({
  message,
  onEdit,
}: {
  message: ForumMessage;
  onEdit: () => void;
}) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const { classSlug, opens } = useClassScope();
  const common = useTranslations("Common");
  const navigate = useNavigate();
  const [hiding, setHiding] = useState(false);
  const start = useMutation(classroom.forum.threads.start);
  const rename = useMutation(
    classroom.forum.threads.rename
  ).withOptimisticUpdate(renameDiscussionUpdate);
  const [renaming, setRenaming] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);
  const { discussion } = message;

  /** Starts a thread from this message and opens it beside its chat. */
  const startThread = () =>
    runForumCall(
      Effect.flatMap(
        forumCall(() =>
          start({
            classId: scope.classId,
            messageId: message.id,
            slug: scope.slug,
          })
        ),
        ({ number }) =>
          Effect.promise(() =>
            navigate(schoolClassDiscussionTarget(scope.slug, classSlug, number))
          )
      ),
      toastForumFailure
    );

  // A message of a thread takes no thread of its own, and one that stands opens from its link.
  const threads =
    opens && scope.discussion === undefined && discussion === null;
  const editable = message.mine && message.poll === null;

  if (!(scope.canPost || scope.canManage)) {
    return null;
  }
  return (
    <>
      {scope.canPost ? <ReactButton message={message} /> : null}
      {threads ? (
        <Button
          aria-label={t("reply-thread")}
          className="shrink-0 pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100"
          onClick={startThread}
          size="icon-xs"
          title={t("reply-thread")}
          variant="ghost"
        >
          <HugeIcons icon={BubbleChatIcon} />
        </Button>
      ) : null}
      {editable || scope.canManage || discussion !== null ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              // With a mouse the menu shows on the message's hover or focus; a touch screen always shows it.
              <Button
                aria-label={common("more-actions")}
                className="shrink-0 pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 pointer-fine:data-popup-open:opacity-100"
                size="icon-xs"
                variant="ghost"
              >
                <HugeIcons icon={MoreHorizontalIcon} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            {editable ? (
              <DropdownMenuItem onClick={onEdit}>
                <HugeIcons icon={PencilEdit02Icon} />
                {t("message-edit")}
              </DropdownMenuItem>
            ) : null}
            {scope.canManage ? (
              <DropdownMenuItem onClick={() => setHiding(true)}>
                <HugeIcons icon={ViewOffSlashIcon} />
                {t("message-hide")}
              </DropdownMenuItem>
            ) : null}
            {discussion === null ? null : (
              <DropdownMenuItem
                onClick={() => {
                  setRenaming((count) => count + 1);
                  setIsRenaming(true);
                }}
              >
                <HugeIcons icon={TextFontIcon} />
                {t("discussion-rename")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <HideMessage message={message} open={hiding} setOpen={setHiding} />
      {discussion === null || renaming === 0 ? null : (
        <LineDialog
          description={t("discussion-rename-description")}
          initial={discussion.title}
          isValid={Schema.is(DiscussionTitleText)}
          key={renaming}
          label={t("discussion-title")}
          onSave={(title) =>
            startTransition(() =>
              saveSchool(
                () =>
                  rename({
                    classId: scope.classId,
                    number: discussion.number,
                    slug: scope.slug,
                    title,
                  }),
                SOURCE
              )
            )
          }
          open={isRenaming}
          placeholder={t("discussion-title-placeholder")}
          setOpen={setIsRenaming}
          title={t("discussion-rename")}
        />
      )}
    </>
  );
}

/**
 * The field that edits the viewer's own message in its place. Save shows the new text at once,
 * and a refusal brings the old text back with the toast every School action uses. A text that is
 * unchanged or not a message keeps the message as it was, and so does Escape.
 */
function MessageEditor({
  message,
  onDone,
  text,
}: {
  message: ForumMessage;
  onDone: () => void;
  text: string;
}) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const common = useTranslations("Common");
  const edit = useMutation(classroom.forum.messages.edit);

  const save = (draft: FormDataEntryValue | null) => {
    onDone();
    const body = Str.trim(typeof draft === "string" ? draft : "");
    if (!Schema.is(MessageText)(body) || body === text) {
      return;
    }
    runForumCall(
      Effect.flatMap(Clock.currentTimeMillis, (at) =>
        forumCall(() =>
          edit.withOptimisticUpdate(editUpdate(at))({
            classId: scope.classId,
            messageId: message.id,
            slug: scope.slug,
            text: body,
          })
        )
      ),
      toastForumFailure
    );
  };

  return (
    <form
      action={(form) => save(form.get("text"))}
      className="flex w-full min-w-0 flex-col gap-2"
    >
      <Textarea
        aria-label={t("message-edit")}
        autoFocus
        defaultValue={text}
        dir="auto"
        name="text"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onDone();
          }
        }}
        placeholder={t("message-placeholder")}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone} size="sm" type="button" variant="outline">
          {common("cancel")}
        </Button>
        <Button size="sm" type="submit">
          {t("message-save")}
        </Button>
      </div>
    </form>
  );
}

/** Asks before a message is hidden for good, and hides it at once when confirmed. */
function HideMessage({
  message,
  open,
  setOpen,
}: {
  message: ForumMessage;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const common = useTranslations("Common");
  const hide = useMutation(classroom.forum.messages.hide);

  const confirm = () => {
    setOpen(false);
    runForumCall(
      forumCall(() =>
        hide.withOptimisticUpdate(hideUpdate)({
          classId: scope.classId,
          messageId: message.id,
          slug: scope.slug,
        })
      ),
      toastForumFailure
    );
  };

  return (
    <ResponsiveDialog
      description={t("hide-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button onClick={confirm} variant="destructive">
            {t("message-hide")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("hide-title")}
    />
  );
}
