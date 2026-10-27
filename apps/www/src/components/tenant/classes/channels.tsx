import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { AddChannel } from "@/components/tenant/classes/add";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";
import { ClassHeader } from "@/components/tenant/classes/header";
import { channelLabel } from "@/components/tenant/classes/label";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

/** How many channels the list asks for each time its end comes into view. */
export const CHANNEL_PAGE_SIZE = 20;

/** A saved channel as a row of the channel table. */
const savedRow = (channel: typeof ChannelView.Type) => ({
  _tag: "channel" as const,
  channel,
});

/** A channel the server is still saving, as a row of the channel table: its name alone. */
const savingRow = (name: string) => ({ _tag: "saving" as const, name });

/** One row of the channel table. */
type ChannelRow = ReturnType<typeof savedRow> | ReturnType<typeof savingRow>;

/** The columns of the channel table. */
const channelColumns = createColumnHelper<
  typeof dataTableFeatures,
  ChannelRow
>();

/**
 * The channel list of a class: the class header with the search over the channels' names and Add
 * channel for whoever manages the forum, and the channels in position order, the general channel
 * first, in the page's one table card. A channel that the server is still saving shows its name
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
 * saved channels with the ones being saved after them in a data table, or nothing while the first
 * page loads. A first page that failed shows the failure alone.
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

  if (loadingFirst) {
    return null;
  }
  if (failed && Arr.isReadonlyArrayEmpty(channels)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  const rows: readonly ChannelRow[] = Arr.appendAll(
    Arr.map(channels, savedRow),
    Arr.map(saving, savingRow)
  );
  const columns = channelColumns.columns([
    channelColumns.accessor(
      (row) =>
        row._tag === "channel"
          ? channelLabel(row.channel, t("general-channel"))
          : row.name,
      {
        cell: (info) => <ChannelName row={info.row.original} />,
        enableSorting: false,
        filterFn: "includesString",
        header: t("channels-title"),
        id: "name",
      }
    ),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={rows}
        rowId={(row) =>
          row._tag === "channel" ? row.channel.id : `saving-${row.name}`
        }
        search="name"
      />
    </>
  );
}

/**
 * A channel's name: a saved channel's opens its messages, the general channel with its translated
 * label and a topic with its name, and one being saved shows muted with no link. A channel with a
 * message the viewer has not read carries one dot, with no count (ADR 0027), and its name says so
 * to assistive technology.
 */
function ChannelName({ row }: { row: ChannelRow }) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  if (row._tag === "saving") {
    return (
      <span className="text-muted-foreground" dir="auto">
        {row.name}
      </span>
    );
  }
  return (
    <TargetLink
      className="flex min-w-0 items-center gap-2 font-medium underline-offset-4 hover:underline"
      dir="auto"
      target={schoolClassChannelTarget(slug, classSlug, row.channel.id)}
    >
      <span className="min-w-0">
        {channelLabel(row.channel, t("general-channel"))}
      </span>
      {row.channel.unread ? (
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
  );
}
