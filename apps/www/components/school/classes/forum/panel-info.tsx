"use client";

import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { getTagIcon } from "@/components/school/classes/_data/tag";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";

/** Render the active forum title row in the class detail panel header. */
export function SchoolClassesForumPanelInfo({
  forum,
}: {
  forum: Forum | undefined;
}) {
  if (!forum) {
    return (
      <div className="flex min-w-0 items-center gap-2 px-2">
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  const Icon = getTagIcon(forum.tag);

  return (
    <div className="flex min-w-0 items-center gap-2 px-2 text-base">
      <HugeIcons className="size-4 shrink-0" icon={Icon} />
      <span className="truncate font-medium">{forum.title}</span>
    </div>
  );
}
