import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { AvatarGroup } from "@repo/design-system/components/ui/avatar";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { ChannelUnread } from "@/components/tenant/classes/channels";
import { ForumFace } from "@/components/tenant/classes/forum/face";
import { isPending } from "@/components/tenant/classes/forum/marks";
import {
  useIsOpenRoot,
  useOpening,
} from "@/components/tenant/classes/forum/open";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { useChannelScope } from "@/components/tenant/classes/forum/scope";
import { useClassScope } from "@/components/tenant/classes/scope";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

/** The summary of the discussion a message opens, as its channel shows it. */
type Discussion = NonNullable<ForumMessage["discussion"]>;

/**
 * The title of a titled discussion above the message that opens it, as one line that may break anywhere: its number
 * and title. While the server saves a new discussion it has no number yet.
 */
export function DiscussionTitle({
  discussion,
  message,
}: {
  discussion: Discussion;
  message: ForumMessage;
}) {
  const t = useTranslations("Classroom");

  return (
    <p className="font-semibold wrap-anywhere" dir="auto">
      {isPending(message)
        ? discussion.title
        : t("discussion-label", {
            number: discussion.number,
            title: discussion.title,
          })}
    </p>
  );
}

/**
 * The thread of a message as Slack and Discord show it under the message: the faces of who answered last, how many
 * replies it holds, when the newest came, and one dot while a reply came after the viewer last read it. The whole
 * row opens the thread beside the chat, and keeps the selected look while it stands open. A thread with no reply yet
 * says so in the same row. While the server saves a new discussion the row waits, since it has no number to open.
 */
export function ThreadSummary({
  discussion,
  message,
}: {
  discussion: Discussion;
  message: ForumMessage;
}) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const { classSlug, slug } = useClassScope();
  const { channelId } = useChannelScope();
  const keep = useOpening((state) => state.keep);
  const open = useIsOpenRoot(message.clientKey);

  if (isPending(message)) {
    return null;
  }
  return (
    <Item
      aria-current={open ? "true" : undefined}
      className="aria-current:bg-muted w-fit max-w-full flex-nowrap group-data-[align=end]/message:self-end"
      onClick={() =>
        keep({ channelId, number: discussion.number, opening: message })
      }
      render={
        <TargetLink
          target={schoolClassDiscussionTarget(
            slug,
            classSlug,
            discussion.number
          )}
        />
      }
      size="xs"
    >
      {Arr.isReadonlyArrayNonEmpty(discussion.repliers) ? (
        <ItemMedia>
          <AvatarGroup>
            {Arr.map(discussion.repliers, (face) => (
              <ForumFace
                face={face}
                key={face.nina ? "nina" : face.id}
                size="sm"
              />
            ))}
          </AvatarGroup>
        </ItemMedia>
      ) : null}
      <ItemContent className="min-w-0">
        <ItemTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold">
            {discussion.replies === 0
              ? t("thread-empty")
              : t("discussion-replies", { count: discussion.replies })}
          </span>
          {discussion.lastReplyAt === null ? null : (
            <span className="text-muted-foreground text-xs font-normal">
              {t("thread-last", {
                time: format.dateTime(
                  DateTime.toDateUtc(
                    DateTime.makeUnsafe(discussion.lastReplyAt)
                  ),
                  {
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                  }
                ),
              })}
            </span>
          )}
        </ItemTitle>
      </ItemContent>
      {discussion.unread ? <ChannelUnread /> : null}
      <ItemActions className="text-muted-foreground">
        <HugeIcons icon={ArrowRight01Icon} />
      </ItemActions>
    </Item>
  );
}
