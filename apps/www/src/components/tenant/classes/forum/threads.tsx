import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ThreadRow } from "@repo/backend/confect/classroom/forum/thread";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { reloadPage } from "@/components/shared/reload";
import { matchesSearch } from "@/components/shared/table/search";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { ChannelUnread } from "@/components/tenant/classes/channels";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

/** How many threads the list asks for each time its end comes into view. */
const THREAD_PAGE_SIZE = 20;

/**
 * The class's threads in the list of chats, the newest first, as Slack gathers them in one view: the
 * search keeps the ones whose title holds its text, and each opens its discussion beside its chat. A
 * class with no thread, like a search that keeps none, says so. The next page loads when the end of
 * the list comes into view.
 */
export function ThreadRows() {
  const t = useTranslations("Classroom");
  const table = useTranslations("DataTable");
  const { classId, slug } = useClassScope();
  const search = useTableFilters((state) => state.search);
  const pagination = usePaginatedQuery(
    classroom.forum.threads.list,
    { classId, slug },
    { initialNumItems: THREAD_PAGE_SIZE }
  );
  if (PaginatedQueryResult.isFailure(pagination)) {
    if (isLostAccess(pagination.error)) {
      throw pagination.error;
    }
    return <LoadFailure onRetry={reloadPage} />;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  const rows = Arr.filter(pagination.results, (row) =>
    matchesSearch(row.discussion.title, search)
  );

  return Arr.isReadonlyArrayEmpty(rows) ? (
    <p className="text-muted-foreground p-4 text-center text-sm">
      {table("no-results")}
    </p>
  ) : (
    <ItemGroup aria-label={t("chat-filter-threads")} className="gap-0.5 p-2">
      {Arr.map(rows, (row) => (
        <ThreadItem key={row.discussion.number} row={row} />
      ))}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection
          onIntersect={() => pagination.loadMore(THREAD_PAGE_SIZE)}
        />
      ) : null}
    </ItemGroup>
  );
}

/** One thread as a row: its number and title, which open it across the whole row, and its replies. */
function ThreadItem({ row }: { row: typeof ThreadRow.Type }) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();
  const { discussion } = row;

  return (
    <Item
      className="hover:bg-muted has-[a[data-status=active]]:bg-accent relative"
      render={<li />}
      size="sm"
    >
      <ItemMedia className="text-muted-foreground" variant="icon">
        <HugeIcons icon={BubbleChatIcon} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <TargetLink
            className="flex min-w-0 items-center gap-2 font-medium after:absolute after:inset-0"
            dir="auto"
            target={schoolClassDiscussionTarget(
              slug,
              classSlug,
              discussion.number
            )}
          >
            <span className="min-w-0 truncate">
              {t("discussion-label", {
                number: discussion.number,
                title: discussion.title,
              })}
            </span>
            {discussion.unread ? <ChannelUnread /> : null}
          </TargetLink>
        </ItemTitle>
        <ItemDescription className="line-clamp-1">
          {discussion.replies === 0
            ? t("discussion-reply")
            : t("discussion-replies", { count: discussion.replies })}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}
