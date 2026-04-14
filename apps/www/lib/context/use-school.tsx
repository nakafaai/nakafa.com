"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContextSelector } from "use-context-selector";

type SchoolRouteValue = FunctionReturnType<
  typeof api.schools.queries.getSchoolBySlug
>;

interface SchoolContextValue {
  school: SchoolRouteValue["school"];
  schoolMembership: SchoolRouteValue["membership"];
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

/**
 * Provide the resolved school route snapshot to the school client subtree.
 */
export function SchoolContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: SchoolRouteValue;
}) {
  return (
    <SchoolContext.Provider
      value={{ school: value.school, schoolMembership: value.membership }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

/** Reads one selected value from the resolved school route snapshot. */
export function useSchool<T>(selector: (state: SchoolContextValue) => T) {
  const context = useContextSelector(SchoolContext, (value) => value);
  if (!context) {
    throw new Error("useSchool must be used within a SchoolContextProvider");
  }
  return selector(context);
}
