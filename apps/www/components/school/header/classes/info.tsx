"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Badge } from "@repo/design-system/components/ui/badge";
import { useQuery } from "convex/react";
import { BookOpen, CalendarIcon } from "lucide-react";
import { useParams } from "next/navigation";

export function SchoolHeaderClassesInfo() {
  const { id } = useParams<{ id: string }>();
  const classInfo = useQuery(api.classes.queries.getClassInfo, {
    classId: id as Id<"schoolClasses">,
  });

  if (!classInfo) {
    return null;
  }

  return (
    <div className="flex w-full items-center gap-4">
      <h1 className="truncate font-medium" title={classInfo.name}>
        {classInfo.name}
      </h1>

      <div className="flex min-w-0 shrink items-center gap-2">
        <Badge
          className="min-w-0 shrink"
          title={classInfo.subject}
          variant="muted"
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="truncate">{classInfo.subject}</span>
        </Badge>
        <Badge
          className="min-w-0 shrink"
          title={classInfo.year}
          variant="muted"
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">{classInfo.year}</span>
        </Badge>
      </div>
    </div>
  );
}
