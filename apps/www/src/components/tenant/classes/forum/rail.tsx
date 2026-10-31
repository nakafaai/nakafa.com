import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
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

/** What the list of chats shows: every chat, the unread ones, or the class's threads. */
const ChatFilter = Schema.Literals(["all", "unread", "threads"]);

/** The key the list's filter keeps its choice under, in the filters of its table page. */
const CHAT_FILTER = "chat";

/**
 * The list of a class's chats, as a chat app keeps it beside the open chat: a search over the names
 * and Add chat for whoever manages the forum, the filters, and the chats in position order, the
 * general chat first. A chat that the server is still saving shows its name without a link. The next
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

/** The list inside its filters. */
function ChatList() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const filter = useChatFilter();
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
  const listed = failed ? [] : pagination.results;
  const empty =
    !(loadingFirst || failed) &&
    Arr.isReadonlyArrayEmpty(listed) &&
    Arr.isReadonlyArrayEmpty(saving);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 p-2">
        <ChatSearch />
        {Arr.contains(can, "forum.manage") ? (
          <AddChannel classId={classId} drafts={drafts} slug={slug} />
        ) : null}
      </div>
      {empty ? (
        <TableEmpty
          act="typing"
          description={t("channels-empty-description")}
          title={t("channels-empty")}
        />
      ) : (
        <>
          <ChatFilters />
          <ScrollArea className="min-h-0 flex-1">
            {filter === "threads" ? (
              <ThreadRows />
            ) : (
              <ChannelRows
                channels={
                  filter === "unread"
                    ? Arr.filter(listed, (channel) => channel.unread)
                    : listed
                }
                failed={failed}
                loadingFirst={loadingFirst}
                saving={filter === "unread" ? [] : saving}
              />
            )}
            {filter !== "threads" &&
            PaginatedQueryResult.isCanLoadMore(pagination) ? (
              <Intersection
                onIntersect={() => pagination.loadMore(CHANNEL_PAGE_SIZE)}
              />
            ) : null}
          </ScrollArea>
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

/** The filters of the list, as WhatsApp sets them above its chats. Choosing the current one keeps it. */
function ChatFilters() {
  const t = useTranslations("Classroom");
  const choose = useTableFilters((state) => state.choose);
  const filter = useChatFilter();

  return (
    <div className="shrink-0 px-2 pb-2">
      <ToggleGroup
        aria-label={t("chat-filter")}
        className="w-full"
        onValueChange={(next) => {
          if (Schema.is(ChatFilter)(next)) {
            choose(CHAT_FILTER, [next]);
          }
        }}
        size="sm"
        type="single"
        value={filter}
        variant="outline"
      >
        {Arr.map(ChatFilter.literals, (value) => (
          <ToggleGroupItem key={value} value={value}>
            {t(`chat-filter-${value}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
