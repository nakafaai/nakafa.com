import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { type StoreApi, useStore } from "zustand";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import type { ChannelDrafts } from "@/components/tenant/classes/drafts";
import { channelLabel } from "@/components/tenant/classes/label";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassChannelTarget } from "@/lib/routing/school/target";

/** How many channels the list asks for each time its end comes into view. */
export const CHANNEL_PAGE_SIZE = 20;

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
export function ChannelList({ drafts }: { drafts: StoreApi<ChannelDrafts> }) {
  const { classId, slug } = useClassScope();
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
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? pagination.loadMore
    : null;

  const failed = PaginatedQueryResult.isFailure(pagination);

  return (
    <>
      {failed ? (
        <div className="p-4">
          <DataFailure onRetry={reloadPage} />
        </div>
      ) : null}
      {pagination._tag === "LoadingFirstPage" ||
      (failed && Arr.isReadonlyArrayEmpty(pagination.results)) ? null : (
        <ChannelTable channels={pagination.results} saving={saving} />
      )}
      {loadMore !== null && (
        <Intersection onIntersect={() => loadMore(CHANNEL_PAGE_SIZE)} />
      )}
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
          <TableRow className="h-12" key={`saving-${name}`}>
            <TableCell className="text-muted-foreground">{name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * One saved channel, which opens its messages: the general channel shows its translated label, a
 * topic shows its name. A channel with a message the viewer has not read carries one dot, with no
 * count (ADR 0027), and its name says so to assistive technology.
 */
function ChannelRow({ channel }: { channel: Channel }) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();
  const label = channelLabel(channel, t("general-channel"));

  return (
    <TableRow className="h-12">
      <TableCell className="font-medium" dir="auto">
        <TargetLink
          className="flex min-w-0 items-center gap-2 underline-offset-4 hover:underline"
          target={schoolClassChannelTarget(slug, classSlug, channel.id)}
        >
          <span className="wrap-anywhere min-w-0">{label}</span>
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
      </TableCell>
    </TableRow>
  );
}
