"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { UserData } from "@repo/backend/convex/lib/userHelpers";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { useMutation, usePaginatedQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { CornerDownRightIcon, DotIcon, MessageSquareIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { Activity, useTransition } from "react";
import { getTagIcon } from "@/components/school/classes/_data/tag";
import { useClass } from "@/lib/context/use-class";
import { useForum } from "@/lib/context/use-forum";
import { searchParsers } from "@/lib/nuqs/search";
import { getLocale } from "@/lib/utils/date";

type ForumListItem = Doc<"schoolClassForums"> & {
  user: UserData | null;
  myReactions: string[];
  unreadCount: number;
};

const DEBOUNCE_TIME = 500;

export function SchoolClassesForumList() {
  const t = useTranslations("School.Classes");

  const locale = useLocale();

  const classId = useClass((state) => state.class._id);
  const [{ q }] = useQueryStates(searchParsers);
  const setActiveForumId = useForum((f) => f.setActiveForumId);

  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);

  const { results, status, loadMore } = usePaginatedQuery(
    api.classes.queries.getForums,
    {
      classId,
      q: debouncedQ,
    },
    { initialNumItems: 50 }
  );

  if (status === "LoadingFirstPage") {
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
    <div className="flex flex-col">
      <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
        {results.map((forum) => {
          const Icon = getTagIcon(forum.tag);
          return (
            <div className="group relative" key={forum._id}>
              <button
                className="absolute inset-0 z-0 cursor-pointer"
                onClick={() => setActiveForumId(forum._id)}
                type="button"
              >
                <span className="sr-only">{forum.title}</span>
              </button>

              <div className="pointer-events-none flex flex-col gap-3 p-4 transition-colors ease-out group-hover:bg-accent/20">
                <Badge variant="muted-outline">
                  <Icon />
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
                        {forum.unreadCount > 25 ? "25+" : forum.unreadCount}
                      </Badge>
                    </Activity>
                  </div>

                  <div className="flex min-w-0 flex-col items-start gap-1 text-muted-foreground text-sm sm:flex-row sm:items-center">
                    <div className="flex max-w-full items-center gap-1">
                      <CornerDownRightIcon className="size-3 shrink-0" />
                      <span className="truncate text-primary">
                        {forum.user?.name ?? t("unknown-user")}
                      </span>
                    </div>
                    <p className="w-full min-w-0 truncate sm:w-auto">
                      {forum.body ?? t("original-message-deleted")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-muted-foreground text-sm">
                  <Activity
                    mode={
                      forum.reactionCounts.length > 0 ? "visible" : "hidden"
                    }
                  >
                    <TopReaction forum={forum} />
                    <DotIcon className="size-3.5 shrink-0" />
                  </Activity>

                  <div className="flex items-center gap-1">
                    <MessageSquareIcon className="size-3.5" />
                    <span className="tracking-tight">{forum.postCount}</span>
                  </div>

                  <DotIcon className="size-3.5 shrink-0" />

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
      {status === "CanLoadMore" && (
        <Intersection onIntersect={() => loadMore(25)} />
      )}
    </div>
  );
}

function TopReaction({ forum }: { forum: ForumListItem }) {
  const [isPending, startTransition] = useTransition();
  const toggleReaction = useMutation(api.classes.mutations.toggleForumReaction);

  // Find the reaction with the highest count
  const topReaction = forum.reactionCounts.reduce((max, r) =>
    r.count > max.count ? r : max
  );
  const isMyReaction = forum.myReactions.includes(topReaction.emoji);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await toggleReaction({ forumId: forum._id, emoji: topReaction.emoji });
    });
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
