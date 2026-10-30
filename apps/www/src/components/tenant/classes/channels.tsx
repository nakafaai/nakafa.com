import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  CheckmarkCircle02Icon,
  HashtagIcon,
  MoreHorizontalIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
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
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { Array as Arr, Clock, Effect, Function as Fn } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { matchesSearch } from "@/components/shared/table/search";
import {
  TableFiltersProvider,
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { EmptyNina } from "@/components/state/empty";
import { AddChannel } from "@/components/tenant/classes/add";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";
import {
  forumCall,
  runForumCall,
} from "@/components/tenant/classes/forum/call";
import { markUpdate } from "@/components/tenant/classes/forum/optimistic";
import { ClassHeader } from "@/components/tenant/classes/header";
import { channelLabel } from "@/components/tenant/classes/label";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

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
 * The channel list of a class: the class header with the search over the channels' names and Add
 * channel for whoever manages the forum, and the channels in position order, the general channel
 * first, as a list of rows in the page's one card, as a chat app lists its channels. A channel that the server is still saving shows its name
 * without a link, so it is inert. The next page loads when the end of the list comes into view, so
 * the list has no button. A class with no channel shows the empty state without a search, a failed
 * read shows its own sentence and a retry, never the empty state, and a viewer who lost the
 * school's access is sent to the refused page.
 */
export function ChannelList() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const [drafts] = useState(createChannelDrafts);
  const pagination = usePaginatedQuery(
    classroom.forum.channels.list,
    { classId, slug },
    { initialNumItems: CHANNEL_PAGE_SIZE }
  );
  const saving = useStore(drafts, (state) => state.names);
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const loadingFirst = pagination._tag === "LoadingFirstPage";
  const failed = PaginatedQueryResult.isFailure(pagination);
  const empty =
    !(loadingFirst || failed) &&
    Arr.isReadonlyArrayEmpty(pagination.results) &&
    Arr.isReadonlyArrayEmpty(saving);

  return (
    <TableFiltersProvider>
      <ClassHeader>
        {empty ? null : <TableSearch placeholder={t("channels-search")} />}
        {Arr.contains(can, "forum.manage") ? (
          <AddChannel classId={classId} drafts={drafts} slug={slug} />
        ) : null}
      </ClassHeader>
      <TablePageBody>
        {empty ? (
          <TableEmpty
            act="typing"
            description={t("channels-empty-description")}
            title={t("channels-empty")}
          />
        ) : (
          <ChannelRows
            channels={failed ? [] : pagination.results}
            failed={failed}
            loadingFirst={loadingFirst}
            saving={saving}
          />
        )}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection
            onIntersect={() => pagination.loadMore(CHANNEL_PAGE_SIZE)}
          />
        ) : null}
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/**
 * The rows of the channel list: the failure of its read above the rows it already holds, and the
 * saved channels with the ones being saved after them, each a row of the list, or nothing while the
 * first page loads. The header's search keeps the channels whose name holds its text, and a search
 * that keeps none says so. A first page that failed shows the failure alone.
 */
function ChannelRows({
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

/**
 * One saved channel as a row: its mark, its name, which opens its messages across the whole row, and
 * its menu. The general channel shows its translated label and a topic its name. A channel with a
 * message the viewer has not read carries one dot, with no count (ADR 0027), and its name says so to
 * assistive technology.
 */
function ChannelItem({ channel }: { channel: typeof ChannelView.Type }) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  return (
    <Item className="relative hover:bg-muted" render={<li />} size="sm">
      <ItemMedia className="text-muted-foreground" variant="icon">
        <HugeIcons icon={HashtagIcon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle>
          <TargetLink
            className="flex min-w-0 items-center gap-2 font-medium after:absolute after:inset-0"
            dir="auto"
            target={schoolClassChannelTarget(slug, classSlug, channel.id)}
          >
            <span className="min-w-0">
              {channelLabel(channel, t("general-channel"))}
            </span>
            {channel.unread ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full bg-primary"
                  data-slot="unread-dot"
                />
                <span className="sr-only">{t("unread")}</span>
              </>
            ) : null}
          </TargetLink>
        </ItemTitle>
      </ItemContent>
      <ItemActions className="relative">
        <ChannelMenu channel={channel} />
      </ItemActions>
    </Item>
  );
}

/** A channel the server is still saving: its name, muted, with no link and no menu, so it is inert. */
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
 * A channel's menu: Open, its messages, and Mark as read, which clears its unread dot at once and
 * marks every message until now as read. A channel with nothing unread keeps Mark as read disabled.
 */
function ChannelMenu({ channel }: { channel: typeof ChannelView.Type }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, classSlug, slug } = useClassScope();
  const mark = useMutation(classroom.forum.reads.mark);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={common("more-actions")}
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
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
