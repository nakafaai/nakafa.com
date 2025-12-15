"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { SchoolClassesJoinForm } from "@/components/school/classes/join-form";

export function SchoolClassesValidation({
  classId,
  children,
}: {
  classId: Id<"schoolClasses">;
  children: React.ReactNode;
}) {
  const result = useQuery(api.classes.queries.verifyClassMembership, {
    classId,
  });
  const classInfo = useQuery(api.classes.queries.getClassInfo, {
    classId,
  });

  if (!(result && classInfo)) {
    return null;
  }

  if (!result.allow) {
    return (
      <SchoolClassesJoinForm
        classId={classId}
        visibility={classInfo.visibility}
      />
    );
  }

  return children;
}
