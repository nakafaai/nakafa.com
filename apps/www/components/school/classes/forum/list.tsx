"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { usePaginatedQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { CornerDownRightIcon, DotIcon, MessageSquareIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { getTagIcon } from "@/components/school/classes/_data/tag";
import { useClass } from "@/lib/context/use-class";
import { useForum } from "@/lib/context/use-forum";
import { searchParsers } from "@/lib/nuqs/search";
import { getLocale } from "@/lib/utils/date";

const DEBOUNCE_TIME = 500;

export function SchoolClassesForumList() {
  const t = useTranslations("School.Classes");

  const locale = useLocale();

  const classId = useClass((state) => state.class._id);
  const [{ q }] = useQueryStates(searchParsers);
  const setActiveForumId = useForum((f) => f.setActiveForumId);

  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);

  const { results, status } = usePaginatedQuery(
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
    <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
      {results.map((forum) => {
        const Icon = getTagIcon(forum.tag);
        return (
          <button
            className="flex cursor-pointer flex-col gap-3 p-4 transition-colors ease-out hover:bg-accent/20"
            key={forum._id}
            onClick={() => {
              setActiveForumId(forum._id);
            }}
            type="button"
          >
            <Badge variant="secondary">
              <Icon />
              {t(forum.tag)}
            </Badge>

            <div className="grid gap-1 text-left">
              <h3 className="truncate font-medium">{forum.title}</h3>

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
          </button>
        );
      })}
    </section>
  );
}
