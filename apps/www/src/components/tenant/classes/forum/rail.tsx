import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { Archive02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ChannelView } from "@repo/backend/confect/classroom/forum/channel";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@repo/design-system/components/ui/input-group";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { AddChannel } from "@/components/tenant/classes/add";
import {
  CHANNEL_PAGE_SIZE,
  ChannelRows,
} from "@/components/tenant/classes/channels";
import { createChannelDrafts } from "@/components/tenant/classes/drafts";
import { ThreadRows } from "@/components/tenant/classes/forum/threads";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";

/** What the list of chats shows: every open chat, the unread ones, the class's threads, or the archived chats. */
const ChatFilter = Schema.Literals(["all", "unread", "threads", "archived"]);

/** The filters that always stand above the list, so the group keeps its shape. Archived chats open from under it. */
const CHAT_FILTERS = ["all", "unread", "threads"] as const;

/** The key the list's filter keeps its choice under, in the filters of its table page. */
const CHAT_FILTER = "chat";

/**
 * The list of a class's chats, as a chat app keeps it beside the open chat: a search over the names
 * and Add chat for whoever manages the forum, the filters, and the chats in position order, the
 * general chat first. An archived chat leaves the list for Archived under it, which shows once a
 * chat is archived. A chat that the server is still saving shows its name without a link. The next
 * page loads when the end of the list comes into view, so the list has no button. A class with no
 * chat shows the empty state without a search, a failed read shows its own sentence and a retry,
 * never the empty state, and a viewer who lost the school's access is sent to the refused page.
 */
export function ChatRail() {
  return (
    <TableFiltersProvider>
      <ChatList />
    </TableFiltersProvider>
  );
}

/** The chats a filter keeps: the archived ones, or the open ones, every one or the unread ones. */
const chatsOf = (
  channels: readonly (typeof ChannelView.Type)[],
  filter: typeof ChatFilter.Type
) =>
  Arr.filter(channels, (channel) =>
    filter === "archived"
      ? channel.archived
      : !channel.archived && (filter !== "unread" || channel.unread)
  );

/** The class's chats, page by page. A viewer who lost the class goes to the page's boundary. */
function useChannelPages() {
  const { classId, slug } = useClassScope();
  const pagination = usePaginatedQuery(
    classroom.forum.channels.list,
    { classId, slug },
    { initialNumItems: CHANNEL_PAGE_SIZE }
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  return pagination;
}

/** What the list shows of its pages and of the channels being saved, under the filter the reader holds. */
function useChatRows(saving: readonly string[]) {
  const chosen = useChatFilter();
  const pagination = useChannelPages();
  const loadingFirst = pagination._tag === "LoadingFirstPage";
  const failed = PaginatedQueryResult.isFailure(pagination);
  const listed = failed ? [] : pagination.results;
  const anyArchived = Arr.some(listed, (channel) => channel.archived);

  return {
    anyArchived,
    empty:
      !(loadingFirst || failed) &&
      Arr.isReadonlyArrayEmpty(listed) &&
      Arr.isReadonlyArrayEmpty(saving),
    failed,
    // Bringing back the last archived chat takes the filter away, so the list falls back to every chat.
    filter: chosen === "archived" && !anyArchived ? "all" : chosen,
    listed,
    loadingFirst,
    pagination,
  };
}

/** The list inside its filters. */
function ChatList() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const [drafts] = useState(createChannelDrafts);
  const saving = useStore(drafts, (state) => state.names);
  const {
    anyArchived,
    empty,
    failed,
    filter,
    listed,
    loadingFirst,
    pagination,
  } = useChatRows(saving);

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2 pt-2 lg:pe-2">
        <div className="flex items-center gap-2">
          <ChatSearch />
          {Arr.contains(can, "forum.manage") ? (
            <AddChannel classId={classId} drafts={drafts} slug={slug} />
          ) : null}
        </div>
        {empty ? null : <ChatFilters filter={filter} />}
      </div>
      {empty ? (
        <TableEmpty
          act="typing"
          description={t("channels-empty-description")}
          title={t("channels-empty")}
        />
      ) : (
        <>
          <ScrollArea className="min-h-0 flex-1">
            {filter === "threads" ? (
              <ThreadRows />
            ) : (
              <ChannelRows
                channels={chatsOf(listed, filter)}
                failed={failed}
                loadingFirst={loadingFirst}
                saving={filter === "all" ? saving : []}
              />
            )}
            {filter !== "threads" &&
            PaginatedQueryResult.isCanLoadMore(pagination) ? (
              <Intersection
                onIntersect={() => pagination.loadMore(CHANNEL_PAGE_SIZE)}
              />
            ) : null}
          </ScrollArea>
          {anyArchived ? <ArchivedChats shown={filter === "archived"} /> : null}
        </>
      )}
    </>
  );
}

/** The search over the names in the list, which keeps its box at every width, as a chat app's does. */
function ChatSearch() {
  const t = useTranslations("Classroom");
  const search = useTableFilters((state) => state.search);
  const setSearch = useTableFilters((state) => state.setSearch);

  return (
    <InputGroup className="min-w-0 flex-1">
      <InputGroupAddon>
        <HugeIcons icon={Search01Icon} />
      </InputGroupAddon>
      <InputGroupInput
        aria-label={t("channels-search")}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("channels-search")}
        value={search}
      />
    </InputGroup>
  );
}

/** The filter the list holds now, every chat until the reader chooses. */
function useChatFilter() {
  const chosen = useTableFilters((state) => state.chosen);
  return Option.getOrElse(
    Option.filter(
      Option.flatMap(Rec.get(chosen, CHAT_FILTER), Arr.head),
      Schema.is(ChatFilter)
    ),
    () => "all" as const
  );
}

/**
 * The filters of the list, joined in one frame as tall as the search above them, as WhatsApp sets them above its
 * chats. They always stand three across the rail, each word the same distance from its lines. Choosing the current one
 * keeps it.
 */
function ChatFilters({ filter }: { filter: typeof ChatFilter.Type }) {
  const t = useTranslations("Classroom");
  const choose = useTableFilters((state) => state.choose);

  return (
    <ToggleGroup
      aria-label={t("chat-filter")}
      className="w-full"
      onValueChange={(next) => {
        if (Schema.is(ChatFilter)(next)) {
          choose(CHAT_FILTER, [next]);
        }
      }}
      value={filter}
    >
      {Arr.map(CHAT_FILTERS, (value) => (
        <ToggleGroupItem key={value} value={value}>
          {t(`chat-filter-${value}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Opens the archived chats, from under the list, as WhatsApp keeps them apart from its filters. */
function ArchivedChats({ shown }: { shown: boolean }) {
  const t = useTranslations("Classroom");
  const choose = useTableFilters((state) => state.choose);

  return (
    <div className="shrink-0 pb-2 lg:pe-2">
      <Button
        aria-pressed={shown}
        className="w-full justify-start"
        onClick={() => choose(CHAT_FILTER, ["archived"])}
        size="sm"
        variant={shown ? "secondary" : "ghost"}
      >
        <HugeIcons icon={Archive02Icon} />
        {t("chat-filter-archived")}
      </Button>
    </div>
  );
}
