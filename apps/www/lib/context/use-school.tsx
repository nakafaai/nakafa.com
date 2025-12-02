"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { useQuery } from "convex/react";
import { createContext, useContextSelector } from "use-context-selector";

type SchoolContextValue = {
  school: Doc<"schools">;
  membership: Doc<"schoolMembers">;
};

const SchoolContext = createContext<SchoolContextValue | null>(null);

export function SchoolContextProvider({
  children,
  slug,
}: {
  children: React.ReactNode;
  slug: string;
}) {
  const results = useQuery(api.schools.queries.getSchoolBySlug, { slug });

  const school = results?.school;
  const membership = results?.membership;

  if (!(school && membership)) {
    return (
      <div className="relative flex h-svh items-center justify-center">
        <SpinnerIcon
          aria-hidden="true"
          className="size-6 shrink-0 text-primary"
        />
      </div>
    );
  }

  return (
    <SchoolContext.Provider value={{ school, membership }}>
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
