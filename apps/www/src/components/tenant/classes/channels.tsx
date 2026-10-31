import { useMutation } from "@confect/react";
import {
  CheckmarkCircle02Icon,
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
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Function as Fn,
  Schema,
} from "effect";
import { startTransition, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { matchesSearch } from "@/components/shared/table/search";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { EmptyNina } from "@/components/state/empty";
import {
  forumCall,
  runForumCall,
} from "@/components/tenant/classes/forum/call";
import { markUpdate } from "@/components/tenant/classes/forum/optimistic";
import { renameChannelUpdate } from "@/components/tenant/classes/forum/rename";
import { channelLabel } from "@/components/tenant/classes/label";
import { useClassScope } from "@/components/tenant/classes/scope";
import { LineDialog } from "@/components/tenant/line";
import { saveSchool } from "@/components/tenant/settings/save";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

const SOURCE = "components/tenant/classes/channels";

/** How many channels the list asks for each time its end comes into view. */
export const CHANNEL_PAGE_SIZE = 20;

/** A saved channel as a row of the channel list. */
const savedRow = (channel: typeof ChannelView.Type) => ({
  _tag: "channel" as const,
  channel,
});

/** A channel the server is still saving, as a row of the channel list: its name alone. */
const savingRow = (name: string) => ({ _tag: "saving" as const, name });

/**
 * The rows of the list of chats: the failure of its read above the rows it already holds, and the
 * saved chats with the ones being saved after them, each a row of the list, or nothing while the
 * first page loads. The list's search keeps the chats whose name holds its text, and a search that
 * keeps none says so. A first page that failed shows the failure alone.
 */
export function ChannelRows({
  channels,
  failed,
  loadingFirst,
  saving,
}: {
  channels: readonly (typeof ChannelView.Type)[];
  failed: boolean;
  loadingFirst: boolean;
  saving: readonly string[];
}) {
  const t = useTranslations("Classroom");
  const table = useTranslations("DataTable");
  const search = useTableFilters((state) => state.search);

  if (loadingFirst) {
    return null;
  }
  if (failed && Arr.isReadonlyArrayEmpty(channels)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  const rows = Arr.filter(
    Arr.appendAll(Arr.map(channels, savedRow), Arr.map(saving, savingRow)),
    (row) =>
      matchesSearch(
        row._tag === "channel"
          ? channelLabel(row.channel, t("general-channel"))
          : row.name,
        search
      )
  );

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {Arr.isReadonlyArrayEmpty(rows) ? (
        <Empty className="p-6 md:p-6">
          <EmptyHeader>
            <EmptyNina act="searching" />
            <EmptyTitle className="text-base">{table("no-results")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup aria-label={t("channels-title")} className="gap-0.5 p-2">
          {Arr.map(rows, (row) =>
            row._tag === "channel" ? (
              <ChannelItem channel={row.channel} key={row.channel.id} />
            ) : (
              <SavingChannelItem key={`saving-${row.name}`} name={row.name} />
            )
          )}
        </ItemGroup>
      )}
    </>
  );
}

/** The one dot of a chat or a thread with something the viewer has not read, with no count (ADR 0027). */
export function ChannelUnread() {
  const t = useTranslations("Classroom");

  return (
    <>
      <span
        aria-hidden="true"
        className="bg-primary size-2 shrink-0 rounded-full"
        data-slot="unread-dot"
      />
      <span className="sr-only">{t("unread")}</span>
    </>
  );
}

/**
 * One saved chat as a row, as a chat app lists it: its mark, its name, which opens it across the
 * whole row, when its newest message came, how that message starts, and its menu. The general chat
 * shows its translated label and a topic its name. The open chat stands out, and a chat with a
 * message the viewer has not read carries one dot.
 */
function ChannelItem({ channel }: { channel: typeof ChannelView.Type }) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  return (
    <Item
      className="group/chat hover:bg-muted has-[a[data-status=active]]:bg-accent relative"
      render={<li />}
      size="sm"
    >
      <ItemMedia className="text-muted-foreground" variant="icon">
        <HugeIcons icon={HashtagIcon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <TargetLink
            className="flex min-w-0 flex-1 items-center gap-2 font-medium after:absolute after:inset-0"
            dir="auto"
            target={schoolClassChannelTarget(slug, classSlug, channel.id)}
          >
            <span className="min-w-0 truncate">
              {channelLabel(channel, t("general-channel"))}
            </span>
            {channel.unread ? <ChannelUnread /> : null}
          </TargetLink>
          {channel.last === null ? null : <ChatTime at={channel.last.at} />}
        </ItemTitle>
        <ItemDescription className="truncate" dir="auto">
          <ChatPreview last={channel.last} />
        </ItemDescription>
      </ItemContent>
      <ItemActions className="relative">
        <ChannelMenu channel={channel} />
      </ItemActions>
    </Item>
  );
}

/** When a chat's newest message came: its time on the reader's day, and its date before that. */
function ChatTime({ at }: { at: number }) {
  const format = useFormatter();
  const written = DateTime.toDateUtc(DateTime.makeUnsafe(at));
  const dayOf = (moment: Date) =>
    format.dateTime(moment, { dateStyle: "short" });
  const today =
    dayOf(written) === dayOf(DateTime.toDateUtc(DateTime.nowUnsafe()));

  return (
    <time
      className="text-muted-foreground shrink-0 text-xs font-normal"
      dateTime={written.toISOString()}
    >
      {format.dateTime(
        written,
        today ? { timeStyle: "short" } : { day: "numeric", month: "short" }
      )}
    </time>
  );
}

/** How a chat's newest message reads in the list: its author and its start, or what it carries. */
function ChatPreview({ last }: { last: (typeof ChannelView.Type)["last"] }) {
  const t = useTranslations("Classroom");

  if (last === null) {
    return t("messages-empty");
  }
  if (last.text === null) {
    return t("message-hidden");
  }
  const text =
    last.text === "" && last.media !== null
      ? t(`chat-media-${last.media}`)
      : last.text;
  return last.mine
    ? t("chat-preview-mine", { text })
    : t("chat-preview", { author: last.author, text });
}

/** A chat the server is still saving: its name, muted, with no link and no menu, so it is inert. */
function SavingChannelItem({ name }: { name: string }) {
  return (
    <Item render={<li />} size="sm">
      <ItemMedia className="text-muted-foreground" variant="icon">
        <HugeIcons icon={HashtagIcon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="text-muted-foreground" dir="auto">
          {name}
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}

/**
 * A channel's menu: Open, its messages, Mark as read, which clears its unread dot at once and marks
 * every message until now as read, and Rename for whoever manages the forum, on a topic channel,
 * since the page translates the general one. A channel with nothing unread keeps Mark as read
 * disabled.
 */
function ChannelMenu({ channel }: { channel: typeof ChannelView.Type }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { can, classId, classSlug, slug } = useClassScope();
  const mark = useMutation(classroom.forum.reads.mark);
  const rename = useMutation(
    classroom.forum.channels.rename
  ).withOptimisticUpdate(renameChannelUpdate);
  const [renaming, setRenaming] = useState(0);
  const [isRenaming, setIsRenaming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            // With a mouse the menu shows on the row's hover or focus; a touch screen always shows it.
            <Button
              aria-label={common("more-actions")}
              className="pointer-fine:opacity-0 pointer-fine:group-focus-within/chat:opacity-100 pointer-fine:group-hover/chat:opacity-100 pointer-fine:data-popup-open:opacity-100"
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <TargetLink
                  target={schoolClassChannelTarget(slug, classSlug, channel.id)}
                >
                  <HugeIcons icon={ViewIcon} />
                  {common("open")}
                </TargetLink>
              }
            />
            <DropdownMenuItem
              disabled={!channel.unread}
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
              <HugeIcons icon={CheckmarkCircle02Icon} />
              {t("channel-mark-read")}
            </DropdownMenuItem>
            {channel.kind === "topic" && Arr.contains(can, "forum.manage") ? (
              <DropdownMenuItem
                onClick={() => {
                  setRenaming((count) => count + 1);
                  setIsRenaming(true);
                }}
              >
                <HugeIcons icon={PencilEdit02Icon} />
                {t("channel-rename")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {renaming === 0 ? null : (
        <LineDialog
          description={t("channel-rename-description")}
          initial={channel.name}
          isValid={Schema.is(ChannelName)}
          key={renaming}
          label={t("channel-name")}
          onSave={(name) =>
            startTransition(() =>
              saveSchool(
                () => rename({ channelId: channel.id, classId, name, slug }),
                SOURCE
              )
            )
          }
          open={isRenaming}
          placeholder={t("channel-name-placeholder")}
          setOpen={setIsRenaming}
          title={t("channel-rename")}
        />
      )}
    </>
  );
}
