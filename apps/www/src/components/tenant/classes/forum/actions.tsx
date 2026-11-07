import { useMutation } from "@confect/react";
import {
  BubbleChatIcon,
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { useNavigate } from "@tanstack/react-router";
import { Effect, Option, Schema } from "effect";
import { type ReactNode, startTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { isPending } from "@/components/tenant/classes/forum/marks";
import { useOpening } from "@/components/tenant/classes/forum/open";
import {
  type ForumMessage,
  hideUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { renameDiscussionUpdate } from "@/components/tenant/classes/forum/rename";
import { messageActionVariants } from "@/components/tenant/classes/forum/reveal";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { ReactButton } from "@/components/tenant/classes/forum/tallies";
import { IconTip } from "@/components/tenant/classes/forum/tip";
import { useClassScope } from "@/components/tenant/classes/scope";
import { LineDialog } from "@/components/tenant/line";
import { saveSchool } from "@/components/tenant/settings/save";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

const SOURCE = "components/tenant/classes/forum/actions";

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
    hasMenu: editable || scope.canManage || discussion !== null,
    threads: scope.discussion === undefined && (opens || discussion !== null),
  };
}

/**
 * The actions of a message: an emoji and Reply in thread, then what the row composes after them, its menu, for
 * whoever writes in the class or manages its forum. A message the server is still saving keeps its controls in place,
 * pressed by nobody, since it has no ID to act on yet.
 */
export function MessageActions({
  children,
  message,
}: {
  /** The message's menu, which the row composes with the edit it opens. */
  children: ReactNode;
  message: ForumMessage;
}) {
  const scope = useChannelScope();
  const { threads } = useMessageRights(message);

  if (!(scope.canPost || scope.canManage)) {
    return null;
  }
  return (
    <>
      {scope.canPost ? <ReactButton message={message} /> : null}
      {threads ? <ThreadButton message={message} /> : null}
      {children}
    </>
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
    runForumCall(
      forumCall(() =>
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
      ),
      toastForumFailure
    );
  };

  return (
    <IconTip label={t("reply-thread")}>
      <Button
        aria-busy={starting || undefined}
        aria-label={t("reply-thread")}
        className={messageActionVariants()}
        disabled={isPending(message) || starting}
        onClick={press}
        size="icon-xs"
        variant="ghost"
      >
        <Spinner icon={BubbleChatIcon} isLoading={starting} />
      </Button>
    </IconTip>
  );
}

/**
 * The menu of a message: Edit on the viewer's own message, Hide for whoever manages the forum, and Rename on the
 * message that opens a discussion, for whoever opened it or a teacher who writes in the class, as the server allows.
 * A message none of them reaches has no menu.
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
  const { editable, hasMenu } = useMessageRights(message);
  const rename = useMutation(
    classroom.forum.threads.rename
  ).withOptimisticUpdate(renameDiscussionUpdate);
  const dialogs = useDialogs<"hide" | "rename">();
  const { discussion } = message;

  if (!hasMenu) {
    return null;
  }
  return (
    <>
      <DropdownMenu>
        <IconTip label={common("more-actions")}>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={common("more-actions")}
                className={messageActionVariants()}
                disabled={isPending(message)}
                size="icon-xs"
                variant="ghost"
              />
            }
          >
            <HugeIcons icon={MoreHorizontalIcon} />
          </DropdownMenuTrigger>
        </IconTip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{common("menu-actions")}</DropdownMenuLabel>
            {editable ? (
              <DropdownMenuItem onClick={onEdit}>
                <HugeIcons icon={PencilEdit02Icon} />
                {t("message-edit")}
              </DropdownMenuItem>
            ) : null}
            {scope.canManage ? (
              <DropdownMenuItem onClick={() => dialogs.show("hide")}>
                <HugeIcons icon={ViewOffSlashIcon} />
                {t("message-hide")}
              </DropdownMenuItem>
            ) : null}
            {discussion === null ? null : (
              <DropdownMenuItem onClick={() => dialogs.show("rename")}>
                <HugeIcons icon={TextFontIcon} />
                {t("discussion-rename")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
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
