"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useQuery } from "convex/react";
import { getTagIcon } from "@/components/school/classes/_data/tag";
import { useForum } from "@/lib/context/use-forum";

export function SchoolClassesForumPostSheetInfo() {
  const activeForumId = useForum((f) => f.activeForumId);

  if (!activeForumId) {
    return null;
  }

  return (
    <div className="flex min-w-0 items-center gap-2 px-2">
      <div className="flex min-w-0 items-center gap-2 text-base">
        <SchoolClassesForumPostSheetInfoTitle forumId={activeForumId} />
      </div>
    </div>
  );
}

function SchoolClassesForumPostSheetInfoTitle({
  forumId,
}: {
  forumId: Id<"schoolClassForums">;
}) {
  const forum = useQuery(api.classes.queries.getForum, {
    forumId,
  });

  if (!forum) {
    return <Skeleton className="h-4 w-24" />;
  }

  const Icon = getTagIcon(forum.tag);

  return (
    <>
      <Icon className="size-4 shrink-0" />
      <span className="truncate font-medium">{forum.title}</span>
    </>
  );
}
