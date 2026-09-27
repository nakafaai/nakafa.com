"use client";

import type { Ref } from "@confect/core";

import type refs from "@repo/backend/confect/_generated/refs";

import { useState } from "react";
import { createContext, useContextSelector } from "use-context-selector";

type SchoolRouteValue = Ref.Returns<
  typeof refs.public.schools.queries.getSchoolBySlug
>;

interface SchoolContextValue {
  school: SchoolRouteValue["school"];
  schoolMembership: SchoolRouteValue["membership"];
}

const SchoolContext = createContext<SchoolContextValue | null>(null);

function createSchoolContextValue(value: SchoolRouteValue): SchoolContextValue {
  return {
    school: value.school,
    schoolMembership: value.membership,
  };
}

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
  const [contextValue, setContextValue] = useState(() =>
    createSchoolContextValue(value)
  );
  let currentContextValue = contextValue;

  if (
    contextValue.school?._id !== value.school?._id ||
    contextValue.schoolMembership?._id !== value.membership?._id
  ) {
    currentContextValue = createSchoolContextValue(value);
    setContextValue(currentContextValue);
  }

  return (
    <SchoolContext.Provider value={currentContextValue}>
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
