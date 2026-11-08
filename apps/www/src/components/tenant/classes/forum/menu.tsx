import { useMutation } from "@confect/react";
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  HashtagIcon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  ChannelName,
  type ChannelView,
} from "@repo/backend/confect/classroom/forum/channel";
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
import {
  ResponsiveDialog,
  ResponsiveDialogSubject,
} from "@repo/design-system/components/ui/responsive-dialog";
import { useNavigate } from "@tanstack/react-router";
import { Array as Arr, Clock, Effect, Function as Fn, Schema } from "effect";
import { startTransition } from "react";
import { useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import {
  archiveChannelUpdate,
  removeChannelUpdate,
} from "@/components/tenant/classes/forum/archive";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { markUpdate } from "@/components/tenant/classes/forum/optimistic";
import { renameChannelUpdate } from "@/components/tenant/classes/forum/rename";
import { useClassScope } from "@/components/tenant/classes/scope";
import { LineDialog } from "@/components/tenant/line";
import { saveSchool } from "@/components/tenant/settings/save";
import { TargetLink } from "@/lib/routing/link";
import {
  schoolClassChannelTarget,
  schoolClassForumTarget,
} from "@/lib/routing/school/target";

const SOURCE = "components/tenant/classes/forum/menu";

/**
 * A channel's menu: Open, its messages, Mark as read, which clears its unread dot at once and marks
 * every message until now as read, and for whoever manages the forum, on a topic channel, Rename,
 * Archive or Restore, and Delete, which asks first and goes back to the list. The general channel is
 * the room of every member, so it keeps all three off. A channel with nothing unread keeps Mark as
 * read disabled.
 */
export function ChannelMenu({ channel }: { channel: typeof ChannelView.Type }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { can, classId, classSlug, slug } = useClassScope();
  const mark = useMutation(classroom.forum.reads.mark);
  const navigate = useNavigate();
  const rename = useMutation(
    classroom.forum.channels.rename
  ).withOptimisticUpdate(renameChannelUpdate);
  const archive = useMutation(
    classroom.forum.channels.archive
  ).withOptimisticUpdate(archiveChannelUpdate);
  const remove = useMutation(
    classroom.forum.channels.remove
  ).withOptimisticUpdate(removeChannelUpdate);
  const dialogs = useDialogs<"remove" | "rename">();
  const managed = channel.kind === "topic" && Arr.contains(can, "forum.manage");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            // With a mouse the menu shows on the row's hover or focus; a touch screen always shows it.
            <Button
              className="pointer-fine:opacity-0 pointer-fine:group-focus-within/chat:opacity-100 pointer-fine:group-hover/chat:opacity-100 pointer-fine:data-popup-open:opacity-100"
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
          <DropdownMenuGroup>
            <DropdownMenuItem
              icon={ViewIcon}
              render={
                <TargetLink
                  target={schoolClassChannelTarget(slug, classSlug, channel.id)}
                />
              }
            >
              {common("open")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!channel.unread}
              icon={CheckmarkCircle02Icon}
              onClick={() =>
                runForumCall(
                  Effect.flatMap(Clock.currentTimeMillis, (at) =>
                    forumCall(() =>
                      mark.withOptimisticUpdate(markUpdate)({
                        at,
                        classId,
                        place: { _tag: "channel", channelId: channel.id },
                        slug,
                      })
                    )
                  ),
                  Fn.constVoid
                )
              }
            >
              {t("channel-mark-read")}
            </DropdownMenuItem>
            {managed ? (
              <DropdownMenuItem
                icon={PencilEdit02Icon}
                onClick={() => dialogs.show("rename")}
              >
                {t("channel-rename")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {managed ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  icon={channel.archived ? ArchiveRestoreIcon : Archive02Icon}
                  onClick={() =>
                    runForumCall(
                      forumCall(() =>
                        archive({
                          archived: !channel.archived,
                          channelId: channel.id,
                          classId,
                          slug,
                        })
                      ),
                      toastForumFailure
                    )
                  }
                >
                  {t(
                    channel.archived ? "channel-unarchive" : "channel-archive"
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  icon={Delete02Icon}
                  onClick={() => dialogs.show("remove")}
                  variant="destructive"
                >
                  {t("channel-remove")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs.kind === "rename" ? (
        <LineDialog
          description={t("channel-rename-description")}
          initial={channel.name}
          isValid={Schema.is(ChannelName)}
          key={dialogs.key}
          label={t("channel-name")}
          onSave={(name) =>
            startTransition(() =>
              saveSchool(
                () => rename({ channelId: channel.id, classId, name, slug }),
                SOURCE
              )
            )
          }
          open={dialogs.isOpen("rename")}
          placeholder={t("channel-name-placeholder")}
          setOpen={dialogs.setOpen}
          title={t("channel-rename")}
        />
      ) : null}
      <ResponsiveDialog
        action={
          <Button
            onClick={() => {
              dialogs.close();
              navigate(schoolClassForumTarget(slug, classSlug));
              runForumCall(
                forumCall(() =>
                  remove({ channelId: channel.id, classId, slug })
                ),
                toastForumFailure
              );
            }}
            type="button"
            variant="destructive"
          >
            {t("channel-remove")}
          </Button>
        }
        description={t("channel-remove-description")}
        open={dialogs.isOpen("remove")}
        setOpen={dialogs.setOpen}
        title={t("channel-remove-title")}
      >
        <ResponsiveDialogSubject icon={HashtagIcon}>
          {channel.name}
        </ResponsiveDialogSubject>
      </ResponsiveDialog>
    </>
  );
}
