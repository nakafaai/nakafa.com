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
import { Clock, DateTime, Effect, Schema, String as Str } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  editUpdate,
  type ForumMessage,
  hideUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";

/**
 * One message of a channel. The viewer's own messages stand at the end of the row, and another
 * member's show the author's name above them. The footer says when the message was written, and
 * that it was edited. A message a teacher hid keeps its place with a sentence that says so and no
 * text. The menu holds Edit on the viewer's own message and Hide for whoever manages the forum.
 */
export function ForumMessageRow({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const written = format.dateTime(
    DateTime.toDateUtc(DateTime.makeUnsafe(message.createdAt)),
    { dateStyle: "medium", timeStyle: "short" }
  );

  return (
    <Message align={message.mine ? "end" : "start"}>
      <MessageContent>
        {message.mine ? null : (
          <MessageHeader dir="auto">{message.author.name}</MessageHeader>
        )}
        {editing && message.text !== null ? (
          <MessageEditor
            message={message}
            onDone={() => setEditing(false)}
            text={message.text}
          />
        ) : (
          <Bubble
            align={message.mine ? "end" : "start"}
            variant={message.mine ? "default" : "muted"}
          >
            <BubbleContent
              className={
                message.text === null ? "italic" : "whitespace-pre-wrap"
              }
              dir="auto"
            >
              {message.text ?? t("message-hidden")}
            </BubbleContent>
          </Bubble>
        )}
        <MessageFooter className="gap-1 px-3">
          <span>{written}</span>
          {message.editedAt === null || message.text === null ? null : (
            <span>{t("message-edited")}</span>
          )}
          {message.text === null || editing ? null : (
            <MessageActions message={message} onEdit={() => setEditing(true)} />
          )}
        </MessageFooter>
      </MessageContent>
    </Message>
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
 * and a refusal brings the old text back with the toast every School action uses. Escape keeps
 * the message as it was.
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
  const [draft, setDraft] = useState(text);
  const body = Str.trim(draft);
  const ready = Schema.is(MessageText)(body) && body !== text;

  const save = () => {
    onDone();
    if (!ready) {
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
      className="flex w-full min-w-0 flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Textarea
        aria-label={t("message-edit")}
        autoFocus
        dir="auto"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onDone();
          }
        }}
        value={draft}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone} size="sm" type="button" variant="outline">
          {common("cancel")}
        </Button>
        <Button disabled={!ready} size="sm" type="submit">
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
