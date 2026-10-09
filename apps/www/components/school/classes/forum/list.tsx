"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  ArrowTurnForwardIcon,
  MessageMultiple02Icon,
} from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import classes from "@repo/backend/confect/_generated/refs/classes";
import type { forumListItemValidator } from "@repo/backend/confect/classes/forums/validators";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Link } from "@repo/internationalization/src/navigation";
import { cn } from "cn";
import { formatDistanceToNow } from "date-fns";
import { Effect } from "effect";
import { useParams, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { Activity, Suspense, useTransition } from "react";
import { toast } from "sonner";
import { getTagIcon } from "@/components/school/classes/data/tag";
import { useForumReactionMutation } from "@/components/school/classes/forum/reaction/mutation.client";
import { getSchoolClassesForumHref } from "@/components/school/classes/forum/routes";
import { DataFailure } from "@/components/shared/failure";
import { reportClientException } from "@/lib/analytics/client";
import { searchParsers } from "@/lib/nuqs/search";
import { useClass } from "@/lib/school/classes/context";
import { getLocale } from "@/lib/utils/date";

type ForumListItem = typeof forumListItemValidator.Type;
const DEBOUNCE_TIME = 500;
const FORUM_UNREAD_BADGE_LIMIT = 25;

/**
 * Render the searchable forum thread list for one class.
 */
export function SchoolClassesForumList() {
  return (
    <Suspense fallback={null}>
      <SchoolClassesForumListContent />
    </Suspense>
  );
}

/** Render the resolved searchable and incrementally loaded forum list. */
function SchoolClassesForumListContent() {
  const t = useTranslations("School.Classes");
  const locale = useLocale();
  const routeParams = useParams<{
    forumId?: Id<"schoolClassForums">;
    id: string;
    slug: string;
  }>();
  const searchParams = useSearchParams();
  const classId = useClass((state) => state.class._id);
  const [{ q }] = useQueryStates(searchParsers);
  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);
  const pagination = usePaginatedQuery(
    classes.forums.queries.forums.getForums,
    {
      classId,
      q: debouncedQ,
    },
    {
      initialNumItems: 50,
    }
  );
  const { results } = pagination;
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    pagination.results.length === 0
  ) {
    return <DataFailure />;
  }
  if (PaginatedQueryResult.isLoadingFirstPage(pagination)) {
    return null;
  }
  if (results.length === 0) {
    return (
      <div className="py-12">
        <p className="text-center text-muted-foreground text-sm">
          {t("no-forum-found")}
        </p>
      </div>
    );
  }
  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) && <DataFailure />}
      <div className="flex flex-col">
        <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
          {results.map((forum) => {
            const Icon = getTagIcon(forum.tag);
            const href = getSchoolClassesForumHref({
              classRouteId: routeParams.id,
              forumId: forum._id,
              queryString: searchParams.toString(),
              slug: routeParams.slug,
            });
            const isActive = routeParams.forumId === forum._id;
            return (
              <div className="group relative" key={forum._id}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className="absolute inset-0 z-0 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  href={href}
                >
                  <span className="sr-only">{forum.title}</span>
                </Link>

                <div
                  className={cn(
                    "pointer-events-none flex flex-col gap-3 p-4 transition-colors ease-out group-focus-within:bg-accent/20 group-hover:bg-accent/20",
                    isActive && "bg-accent/20"
                  )}
                >
                  <Badge variant="outline">
                    <HugeIcons icon={Icon} />
                    {t(forum.tag)}
                  </Badge>

                  <div className="grid gap-1 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="min-w-0 truncate font-medium">
                        {forum.title}
                      </h3>
                      <Activity
                        mode={forum.unreadCount > 0 ? "visible" : "hidden"}
                      >
                        <Badge variant="destructive">
                          {forum.unreadCount > FORUM_UNREAD_BADGE_LIMIT
                            ? `${FORUM_UNREAD_BADGE_LIMIT}+`
                            : forum.unreadCount}
                        </Badge>
                      </Activity>
                    </div>

                    <div className="flex min-w-0 flex-col items-start gap-1 text-muted-foreground text-sm sm:flex-row sm:items-center">
                      <div className="flex max-w-full items-center gap-1">
                        <HugeIcons
                          className="size-3 shrink-0"
                          icon={ArrowTurnForwardIcon}
                        />
                        <span
                          className={cn(
                            "truncate text-primary group-focus-within:text-foreground group-hover:text-foreground",
                            isActive && "text-foreground"
                          )}
                        >
                          {forum.user?.name ?? t("unknown-user")}
                        </span>
                      </div>
                      <p className="w-full min-w-0 truncate sm:w-auto">
                        {forum.body ?? t("original-message-deleted")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-muted-foreground text-sm">
                    <Activity
                      mode={
                        forum.reactionCounts.length > 0 ? "visible" : "hidden"
                      }
                    >
                      <TopReaction forum={forum} />
                    </Activity>

                    <div className="flex items-center gap-1">
                      <HugeIcons
                        className="size-3.5"
                        icon={MessageMultiple02Icon}
                      />
                      <span className="tracking-tight">{forum.postCount}</span>
                    </div>

                    <time className="min-w-0 truncate tracking-tight">
                      {formatDistanceToNow(forum.lastPostAt, {
                        locale: getLocale(locale),
                        addSuffix: true,
                      })}
                    </time>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        {PaginatedQueryResult.isCanLoadMore(pagination) && (
          <Intersection onIntersect={() => pagination.loadMore(25)} />
        )}
      </div>
    </>
  );
}

/**
 * Surface the most-used reaction as a compact shortcut in the forum list.
 */
function TopReaction({ forum }: { forum: ForumListItem }) {
  const actionErrorMessage = useTranslations("Common")("action-error");
  const [isPending, startTransition] = useTransition();
  const toggleReaction = useForumReactionMutation();
  const firstReaction = forum.reactionCounts[0];
  if (!firstReaction) {
    return null;
  }
  const topReaction = forum.reactionCounts.reduce(
    (maxReaction, reaction) =>
      reaction.count > maxReaction.count ? reaction : maxReaction,
    firstReaction
  );
  const isMyReaction = forum.myReactions.includes(topReaction.emoji);

  /** Toggle the leading reaction without activating the forum link. */
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () =>
      Effect.runPromise(
        Effect.asVoid(
          Effect.tryPromise(() =>
            toggleReaction({
              forumId: forum._id,
              emoji: topReaction.emoji,
            })
          ).pipe(Effect.flatMap(Effect.fromResult))
        ).pipe(
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/school/classes/forum/list",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  };
  return (
    <Button
      className="pointer-events-auto relative z-1"
      disabled={isPending}
      onClick={handleToggle}
      size="sm"
      variant={isMyReaction ? "default-outline" : "outline"}
    >
      {topReaction.emoji}
      <span className="tracking-tight">{topReaction.count}</span>
    </Button>
  );
}
