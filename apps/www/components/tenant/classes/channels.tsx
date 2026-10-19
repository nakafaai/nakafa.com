"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { useIntersection } from "@mantine/hooks";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { type StoreApi, useStore } from "zustand";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import type { ChannelDrafts } from "@/components/tenant/classes/drafts";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many channels the list asks for each time its end comes into view. */
const CHANNEL_PAGE_SIZE = 20;

/** One channel of a class, as the list shows it. */
type Channel = typeof ChannelView.Type;

/**
 * The channels of a class in position order, the general channel first, in a data table.
 * A channel that the server is still saving shows its name without the rest of its row, so
 * it is inert. The next page loads when the end of the list comes into view, so the list has
 * no button. When the class holds no channel, the table shows its empty state. A failed read
 * shows its own sentence and a retry, never the empty state, and a viewer who lost the
 * school's access is sent to the refused page.
 */
export function ChannelList({
  classId,
  drafts,
  slug,
}: {
  classId: Id<"classes">;
  drafts: StoreApi<ChannelDrafts>;
  slug: TenantSlug;
}) {
  const pagination = usePaginatedQuery(
    classroom.forum.channels.list,
    { classId, slug },
    { initialNumItems: CHANNEL_PAGE_SIZE }
  );
  const saving = useStore(drafts, (state) => state.names);
  const { entry, ref } = useIntersection<HTMLDivElement>();
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? pagination.loadMore
    : null;
  const atEnd = entry?.isIntersecting === true;

  useEffect(() => {
    if (atEnd && loadMore !== null) {
      loadMore(CHANNEL_PAGE_SIZE);
    }
  }, [atEnd, loadMore]);

  const failure = PaginatedQueryResult.isFailure(pagination) ? (
    <DataFailure onRetry={reloadPage} />
  ) : null;

  return (
    <>
      {failure}
      {pagination._tag === "LoadingFirstPage" ||
      (failure !== null &&
        Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
        <ChannelTable channels={pagination.results} saving={saving} />
      )}
      <div aria-hidden ref={ref} />
    </>
  );
}

/**
 * The channels in a data table, or the table's empty state when the class holds none and no
 * channel is being saved.
 */
function ChannelTable({
  channels,
  saving,
}: {
  channels: readonly Channel[];
  saving: readonly string[];
}) {
  const t = useTranslations("Classroom");

  if (Arr.isReadonlyArrayEmpty(channels) && Arr.isReadonlyArrayEmpty(saving)) {
    return (
      <TableEmpty
        act="typing"
        description={t("channels-empty-description")}
        title={t("channels-empty")}
      />
    );
  }

  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("channels-title")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(channels, (channel) => (
            <ChannelRow channel={channel} key={channel.id} />
          ))}
          {Arr.map(saving, (name) => (
            <TableRow key={`saving-${name}`}>
              <TableCell className="text-muted-foreground">{name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/** One saved channel: the general channel shows its translated label, a topic shows its name. */
function ChannelRow({ channel }: { channel: Channel }) {
  const t = useTranslations("Classroom");
  const label =
    channel.kind === "general" ? t("general-channel") : channel.name;

  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
    </TableRow>
  );
}
