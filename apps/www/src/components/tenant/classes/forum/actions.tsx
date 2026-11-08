import { useMutation } from "@confect/react";
import {
  BubbleChatIcon,
  Copy01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  TextFontIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  DiscussionTitle as DiscussionTitleText,
  threadTitle,
} from "@repo/backend/confect/classroom/forum/thread";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { type ReactNode, startTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import { isPending } from "@/components/tenant/classes/forum/marks";
import { useOpening } from "@/components/tenant/classes/forum/open";
import {
  type ForumMessage,
  hideUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { renameDiscussionUpdate } from "@/components/tenant/classes/forum/rename";
import { messageToolbarVariants } from "@/components/tenant/classes/forum/reveal";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { ReactButton } from "@/components/tenant/classes/forum/tallies";
import { useClassScope } from "@/components/tenant/classes/scope";
import { LineDialog } from "@/components/tenant/line";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

/**
 * What the viewer may do with a message: edit their own, manage the forum, and open the message's thread, which any
 * message of a channel takes, as in Slack and Discord, while the class lets the viewer open threads or the thread
 * stands already. A reply in a thread takes no thread of its own.
 */
function useMessageRights({ discussion, mine, poll }: ForumMessage) {
  const scope = useChannelScope();
  const { opens } = useClassScope();
  const editable = mine && poll === null;

  return {
    editable,
    threads: scope.discussion === undefined && (opens || discussion !== null),
  };
}

/**
 * The toolbar of a message, as Slack and Discord float one over the row's top corner on the bubble's inner side: an
 * emoji, Reply in thread, then what the row composes after them, its menu, each a square button of one size with its
 * tooltip. With a mouse it shows on the row's hover or focus and while one of its popups is open; a tap on the row
 * shows it on a touch screen. A message the server is still saving keeps its controls in place, pressed by nobody,
 * since it has no ID to act on yet.
 */
export function MessageToolbar({
  children,
  message,
}: {
  /** The message's menu, which the row composes with the edit it opens. */
  children: ReactNode;
  message: ForumMessage;
}) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const { threads } = useMessageRights(message);

  return (
    <div
      aria-label={t("message-actions")}
      className={messageToolbarVariants({ mine: message.mine })}
      role="toolbar"
    >
      {scope.canPost ? <ReactButton message={message} /> : null}
      {threads && (scope.canPost || scope.canManage) ? (
        <ThreadButton message={message} />
      ) : null}
      {children}
    </div>
  );
}

/**
 * Reply in thread: opens the message's thread in the pane beside the chat, drawn at once from the message itself. A
 * message without a thread starts one first under the class's next number, and its button stays pressed until the
 * server answers; a refusal says why in a toast and opens nothing.
 */
function ThreadButton({ message }: { message: ForumMessage }) {
  const t = useTranslations("Classroom");
  const scope = useChannelScope();
  const { classSlug } = useClassScope();
  const navigate = useNavigate();
  const start = useMutation(classroom.forum.threads.start);
  const keep = useOpening((state) => state.keep);
  const mark = useOpening((state) => state.start);
  const starting = useOpening((state) =>
    Option.contains(state.starting, message.clientKey)
  );

  /** Opens the thread at `number`, its pane drawn from `opening` until the server answers. */
  const open = (number: number, opening: ForumMessage) => {
    keep({ channelId: scope.channelId, number, opening });
    return navigate(schoolClassDiscussionTarget(scope.slug, classSlug, number));
  };

  /** Opens the message's thread, starting it first when it has none. */
  const press = () => {
    if (message.discussion !== null) {
      open(message.discussion.number, message);
      return;
    }
    mark(Option.some(message.clientKey));
    runSchoolWrite(
      schoolCall(() =>
        start({
          classId: scope.classId,
          messageId: message.id,
          slug: scope.slug,
        })
      ).pipe(
        Effect.flatMap(({ number }) =>
          Effect.promise(() =>
            open(number, {
              ...message,
              discussion: {
                lastReplyAt: null,
                number,
                repliers: [],
                replies: 0,
                title: threadTitle(message),
                unread: false,
              },
            })
          )
        ),
        Effect.ensuring(Effect.sync(() => mark(Option.none())))
      )
    );
  };

  return (
    <Button
      aria-busy={starting || undefined}
      disabled={isPending(message) || starting}
      onClick={press}
      size="icon"
      tooltip={t("reply-thread")}
      variant="ghost"
    >
      <Spinner icon={BubbleChatIcon} isLoading={starting} />
    </Button>
  );
}

/**
 * The menu of a message, as every menu reads: its label, then the main actions, Copy text when it has words, Edit on
 * the viewer's own message and Rename on the message that opens a discussion for whoever opened it or a teacher who
 * writes in the class, as the server allows; then, apart, Hide in the destructive style for whoever manages the forum.
 * A message none of them reaches, such as another member's poll, has no menu.
 */
export function MessageMenu({
  message,
  onEdit,
}: {
  message: ForumMessage;
  onEdit: () => void;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const scope = useChannelScope();
  const { editable } = useMessageRights(message);
  const rename = useMutation(
    classroom.forum.threads.rename
  ).withOptimisticUpdate(renameDiscussionUpdate);
  const dialogs = useDialogs<"hide" | "rename">();
  const { discussion } = message;
  const words = message.text ?? "";

  /** Copies the message's text, and says so. */
  const copy = () =>
    Effect.runPromise(
      Effect.tryPromise(() => navigator.clipboard.writeText(words)).pipe(
        Effect.match({
          onFailure: () => toast.error({ title: "copy-error.title" }),
          onSuccess: () => toast.success({ title: "copy-success.title" }),
        })
      )
    );

  if (!(words !== "" || editable || discussion !== null || scope.canManage)) {
    return null;
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              disabled={isPending(message)}
              size="icon"
              tooltip={common("more-actions")}
              variant="ghost"
            />
          }
        >
          <HugeIcons icon={MoreHorizontalIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          label={common("menu-actions")}
        >
          {words === "" ? null : (
            <DropdownMenuItem icon={Copy01Icon} onClick={copy}>
              {t("message-copy")}
            </DropdownMenuItem>
          )}
          {editable ? (
            <DropdownMenuItem icon={PencilEdit02Icon} onClick={onEdit}>
              {t("message-edit")}
            </DropdownMenuItem>
          ) : null}
          {discussion === null ? null : (
            <DropdownMenuItem
              icon={TextFontIcon}
              onClick={() => dialogs.show("rename")}
            >
              {t("discussion-rename")}
            </DropdownMenuItem>
          )}

          {scope.canManage ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  icon={ViewOffSlashIcon}
                  onClick={() => dialogs.show("hide")}
                  variant="destructive"
                >
                  {t("message-hide")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <HideMessage
        message={message}
        open={dialogs.isOpen("hide")}
        setOpen={dialogs.setOpen}
      />
      {discussion === null || dialogs.kind !== "rename" ? null : (
        <LineDialog
          description={t("discussion-rename-description")}
          initial={discussion.title}
          isValid={Schema.is(DiscussionTitleText)}
          key={dialogs.key}
          label={t("discussion-title")}
          onSave={(title) =>
            startTransition(() =>
              runSchoolWrite(
                schoolCall(() =>
                  rename({
                    classId: scope.classId,
                    number: discussion.number,
                    slug: scope.slug,
                    title,
                  })
                )
              )
            )
          }
          open={dialogs.isOpen("rename")}
          placeholder={t("discussion-title-placeholder")}
          setOpen={dialogs.setOpen}
          title={t("discussion-rename")}
        />
      )}
    </>
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
  const hide = useMutation(classroom.forum.messages.hide);

  const confirm = () => {
    setOpen(false);
    runSchoolWrite(
      schoolCall(() =>
        hide.withOptimisticUpdate(hideUpdate)({
          classId: scope.classId,
          messageId: message.id,
          slug: scope.slug,
        })
      )
    );
  };

  return (
    <ResponsiveDialog
      action={
        <Button onClick={confirm} variant="destructive">
          {t("message-hide")}
        </Button>
      }
      description={t("hide-description")}
      open={open}
      setOpen={setOpen}
      title={t("hide-title")}
    >
      {/* What the hide takes away: the message's words, as its readers see them now. */}
      <p
        className="bg-muted max-h-40 overflow-y-auto rounded-lg p-3 text-sm wrap-anywhere whitespace-pre-wrap"
        dir="auto"
      >
        {message.text}
      </p>
    </ResponsiveDialog>
  );
}
