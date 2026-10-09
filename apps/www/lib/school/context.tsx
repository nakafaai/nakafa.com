"use client";

import type { Ref } from "@confect/core";

import type schools from "@repo/backend/confect/_generated/refs/schools";

import { createContext, use, useState } from "react";

type SchoolRouteValue = Ref.Returns<typeof schools.queries.getSchoolBySlug>;

function createSchoolContextValue(value: SchoolRouteValue) {
  return {
    school: value.school,
    schoolMembership: value.membership,
  };
}

type SchoolContextValue = ReturnType<typeof createSchoolContextValue>;

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

  return <SchoolContext value={currentContextValue}>{children}</SchoolContext>;
}

/** Reads one selected value from the resolved school route snapshot. */
export function useSchool<T>(selector: (state: SchoolContextValue) => T) {
  const value = use(SchoolContext);
  if (!value) {
    throw new Error("useSchool must be used within a SchoolContextProvider");
  }
  return selector(value);
}
