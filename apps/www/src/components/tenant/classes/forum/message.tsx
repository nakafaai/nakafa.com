import { useMutation } from "@confect/react";
import {
  MoreHorizontalIcon,
  PencilEdit02Icon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { MessageText } from "@repo/backend/confect/classroom/forum/message";
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
  MessageFooter,
  MessageHeader,
} from "@repo/design-system/components/ui/message";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Schema,
  String as Str,
} from "effect";
import { useState } from "react";
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
import {
  editUpdate,
  type ForumMessage,
  hideUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { mentionSegments } from "@/components/tenant/classes/forum/mentions";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";

/**
 * One message of a channel or of a discussion. The viewer's own messages stand at the end of the
 * row, and another member's show the author's name above the first message of a run by the same
 * author (`opens`). A message that opens a discussion shows the discussion's title above it and its
 * replies under it in the channel. The viewer's own message turns into its edit field in place.
 */
export function ForumMessageRow({
  message,
  opens,
}: {
  message: ForumMessage;
  opens: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const scope = useChannelScope();
  // Inside its own discussion the opening message needs no summary: the discussion is the page.
  const discussion = scope.discussion === undefined ? message.discussion : null;

  return (
    <Message align={message.mine ? "end" : "start"}>
      <MessageContent>
        {message.mine || !(opens || discussion !== null) ? null : (
          <MessageHeader dir="auto">{message.author.name}</MessageHeader>
        )}
        {discussion === null ? null : (
          <DiscussionTitle discussion={discussion} message={message} />
        )}
        {editing && message.text !== null ? (
          <MessageEditor
            message={message}
            onDone={() => setEditing(false)}
            text={message.text}
          />
        ) : (
          <MessageBubble message={message} />
        )}
        {discussion === null ? null : (
          <DiscussionReplies discussion={discussion} message={message} />
        )}
        <MessageMeta
          editing={editing}
          message={message}
          onEdit={() => setEditing(true)}
        />
      </MessageContent>
    </Message>
  );
}

/**
 * The body of a message: its text in the author's colour for the viewer's own message, and muted
 * for another member's. A message a teacher hid keeps its place with a sentence that says so.
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
      </BubbleContent>
    </Bubble>
  );
}

/**
 * The footer of a message: when it was written, that it was edited, and its menu, which a hidden
 * message and one in its edit field do not show.
 */
function MessageMeta({
  editing,
  message,
  onEdit,
}: {
  editing: boolean;
  message: ForumMessage;
  onEdit: () => void;
}) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const written = format.dateTime(
    DateTime.toDateUtc(DateTime.makeUnsafe(message.createdAt)),
    { dateStyle: "medium", timeStyle: "short" }
  );
  const live = message.text !== null;

  return (
    <MessageFooter className="gap-1 px-3">
      <span>{written}</span>
      {live && message.editedAt !== null ? (
        <span>{t("message-edited")}</span>
      ) : null}
      {live && !editing ? (
        <MessageActions message={message} onEdit={onEdit} />
      ) : null}
    </MessageFooter>
  );
}

/** The menu of a message: Edit on the viewer's own message, Hide for whoever manages the forum. */
function MessageActions({
  message,
  onEdit,
}: {
  message: ForumMessage;
  onEdit: () => void;
}) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const common = useTranslations("Common");
  const [hiding, setHiding] = useState(false);

  if (!(message.mine || scope.canManage)) {
    return null;
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-xs"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          {message.mine ? (
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
        </DropdownMenuContent>
      </DropdownMenu>
      <HideMessage message={message} open={hiding} setOpen={setHiding} />
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
