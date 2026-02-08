"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { createContext, useContextSelector } from "use-context-selector";
import { SchoolLoader } from "@/components/school/loader";

interface SchoolContextValue {
  school: Doc<"schools">;
  schoolMembership: Doc<"schoolMembers">;
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

export function SchoolContextProvider({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const { data: results } = useQueryWithStatus(
    api.schools.queries.getSchoolBySlug,
    { slug }
  );

  const school = results?.school;
  const schoolMembership = results?.membership;

  if (!(school && schoolMembership)) {
    return <SchoolLoader />;
  }

  return (
    <SchoolContext.Provider value={{ school, schoolMembership }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool<T>(selector: (state: SchoolContextValue) => T) {
  const context = useContextSelector(SchoolContext, (value) => value);
  if (!context) {
    throw new Error("useSchool must be used within a SchoolContextProvider");
  }
  return selector(context);
}
