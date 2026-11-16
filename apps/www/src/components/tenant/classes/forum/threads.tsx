import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Archive02Icon,
  ArrowTurnBackwardIcon,
  BubbleChatIcon,
  MoreHorizontalIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { ThreadRow } from "@repo/backend/confect/classroom/forum/thread";
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
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { Array as Arr } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { useTranslations } from "use-intl";
import { reloadPage } from "@/components/shared/reload";
import { matchesSearch } from "@/components/shared/table/search";
import { useTableFilters } from "@/components/shared/table/toolbar";
import { TableViews } from "@/components/shared/table/views";
import { LoadFailure } from "@/components/state/failure";
import { ChannelUnread } from "@/components/tenant/classes/channels";
import {
  archiveThreadUpdate,
  restoreThreadUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";
import { isLostAccess } from "@/components/tenant/refusal";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

/** How many threads the list asks for each time its end comes into view. */
const THREAD_PAGE_SIZE = 20;

/** The class's threads, page by page: the open ones, or the archived ones for whoever manages the forum. */
function useThreadPages(archived: boolean, asked: boolean) {
  const { classId, slug } = useClassScope();
  const pagination = usePaginatedQuery(
    classroom.forum.threads.list,
    asked ? { classId, slug, ...(archived ? { archived } : {}) } : "skip",
    { initialNumItems: THREAD_PAGE_SIZE }
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  return pagination;
}

/** The two lists of the class's threads. */
type ThreadLists = Record<
  "active" | "archived",
  ReturnType<typeof useThreadPages>
>;

const ThreadListsContext = createContext<ThreadLists | null>(null);

/**
 * Reads the class's open threads, and its archived ones for whoever manages the forum, for as long as the list of
 * chats stands, so the Threads filter and its Active and Archived views show their rows at once, as a chat app
 * switches its tabs, and never empty the list while a read starts.
 */
export function ThreadListsProvider({ children }: { children: ReactNode }) {
  const { can } = useClassScope();
  const active = useThreadPages(false, true);
  const archived = useThreadPages(true, Arr.contains(can, "forum.manage"));

  return (
    <ThreadListsContext value={{ active, archived }}>
      {children}
    </ThreadListsContext>
  );
}

/**
 * The class's threads in the list of chats, the newest first, as Slack gathers them in one view: the
 * search keeps the ones whose title holds its text, and each opens its discussion beside its chat. A
 * class with no thread, like a search that keeps none, says so. The next page loads when the end of
 * the list comes into view. Whoever manages the forum switches between the open and the archived
 * threads, and the views stay while a list reads its first page.
 */
export function ThreadRows() {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();
  const lists = use(ThreadListsContext);
  const search = useTableFilters((state) => state.search);
  const [view, setView] = useState<"active" | "archived">("active");
  if (lists === null) {
    throw new Error("ThreadRows must be used within ThreadListsProvider");
  }
  const pagination = lists[view];

  return (
    <>
      {Arr.contains(can, "forum.manage") ? (
        <div className="py-2 lg:pe-2">
          <TableViews
            label={t("threads-views")}
            onChoose={setView}
            view={view}
            views={[
              {
                icon: BubbleChatIcon,
                label: t("view-active"),
                value: "active",
              },
              {
                icon: Archive02Icon,
                label: t("threads-archived"),
                value: "archived",
              },
            ]}
          />
        </div>
      ) : null}
      {PaginatedQueryResult.isFailure(pagination) ? (
        <LoadFailure onRetry={reloadPage} />
      ) : null}
      {pagination._tag === "LoadingFirstPage" ||
      PaginatedQueryResult.isFailure(pagination) ? null : (
        <ThreadList
          onLoadMore={
            PaginatedQueryResult.isCanLoadMore(pagination)
              ? () => pagination.loadMore(THREAD_PAGE_SIZE)
              : null
          }
          rows={Arr.filter(pagination.results, (row) =>
            matchesSearch(row.discussion.title, search)
          )}
        />
      )}
    </>
  );
}

/** The discussions the list keeps, or the sentence that none matches, and the next page as the end comes into view. */
function ThreadList({
  onLoadMore,
  rows,
}: {
  /** Loads the next page, while the list has one. */
  onLoadMore: (() => void) | null;
  rows: readonly (typeof ThreadRow.Type)[];
}) {
  const t = useTranslations("Classroom");
  const table = useTranslations("DataTable");

  return Arr.isReadonlyArrayEmpty(rows) ? (
    <p className="text-muted-foreground p-4 text-center text-sm">
      {table("no-results")}
    </p>
  ) : (
    <ItemGroup
      aria-label={t("chat-filter-threads")}
      className="gap-0.5 py-2 lg:pe-2"
    >
      {Arr.map(rows, (row) => (
        <ThreadItem key={row.discussion.number} row={row} />
      ))}
      {onLoadMore === null ? null : <Intersection onIntersect={onLoadMore} />}
    </ItemGroup>
  );
}

/** One thread as a row: its number and title, which open it across the whole row, and its replies. */
function ThreadItem({ row }: { row: typeof ThreadRow.Type }) {
  const t = useTranslations("Classroom");
  const { can, classSlug, slug } = useClassScope();
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
            <span className="min-w-0 wrap-anywhere">
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
            ? t("thread-empty")
            : t("discussion-replies", { count: discussion.replies })}
        </ItemDescription>
      </ItemContent>
      {Arr.contains(can, "forum.manage") ? <ThreadShelf row={row} /> : null}
    </Item>
  );
}

/**
 * A discussion's menu for whoever manages the forum: Archive, which takes it out of the class's list, or Restore on an
 * archived one. The row leaves its list at once and comes back with the School toast on a refusal.
 */
function ThreadShelf({ row }: { row: typeof ThreadRow.Type }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, classSlug, slug } = useClassScope();
  const archive = useMutation(classroom.forum.threads.archive);
  const restore = useMutation(classroom.forum.threads.restore);
  const args = { classId, number: row.discussion.number, slug };

  return (
    <ItemActions className="relative">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
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
          className="w-44"
          label={common("menu-actions")}
        >
          <DropdownMenuItem
            icon={ViewIcon}
            render={
              <TargetLink
                target={schoolClassDiscussionTarget(
                  slug,
                  classSlug,
                  row.discussion.number
                )}
              />
            }
          >
            {common("open")}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {row.archived ? (
              <DropdownMenuItem
                icon={ArrowTurnBackwardIcon}
                onClick={() =>
                  runSchoolWrite(
                    schoolCall(() =>
                      restore.withOptimisticUpdate(restoreThreadUpdate)(args)
                    )
                  )
                }
              >
                {t("discussion-restore")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                icon={Archive02Icon}
                onClick={() =>
                  runSchoolWrite(
                    schoolCall(() =>
                      archive.withOptimisticUpdate(archiveThreadUpdate)(args)
                    )
                  )
                }
              >
                {t("discussion-archive")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </ItemActions>
  );
}
