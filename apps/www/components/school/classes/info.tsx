"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery } from "convex/react";
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
      <div className="flex w-full items-center px-2.5">
        <h1 className="truncate font-medium" title={classInfo.name}>
          {classInfo.name}
        </h1>
      </div>
    </HeaderContainer>
  );
}
