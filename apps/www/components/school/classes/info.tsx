"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { useQuery } from "convex/react";
import { BookOpen, CalendarIcon } from "lucide-react";
import { HeaderContainer } from "@/components/school/header-container";
import { useClass } from "@/lib/context/use-class";

export function SchoolClassesHeaderInfo() {
  const classId = useClass((state) => state.class._id);
  const classInfo = useQuery(api.classes.queries.getClassInfo, {
    classId,
  });

  if (!classInfo) {
    return <HeaderContainer className="relative border-b-0" />;
  }

  return (
    <HeaderContainer className="relative border-b-0">
      <div className="flex w-full items-center gap-4 px-2.5">
        <h1 className="truncate font-medium" title={classInfo.name}>
          {classInfo.name}
        </h1>

        <div className="hidden min-w-0 shrink items-center gap-2 sm:flex">
          <Badge
            className="min-w-0 shrink"
            title={classInfo.subject}
            variant="outline"
          >
            <BookOpen className="size-4 shrink-0" />
            <span className="truncate">{classInfo.subject}</span>
          </Badge>
          <Badge
            className="min-w-0 shrink"
            title={classInfo.year}
            variant="outline"
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">{classInfo.year}</span>
          </Badge>
        </div>
      </div>
    </HeaderContainer>
  );
}
