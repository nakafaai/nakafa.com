"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { useConvexAuth } from "convex/react";

import { createContext, useContextSelector } from "use-context-selector";

type ClassContextValue = Extract<
  Ref.Returns<typeof refs.public.classes.queries.getClassRoute>,
  { kind: "accessible" }
>;

const missingClass = Symbol("missing-class");

const ClassContext = createContext<ClassContextValue | typeof missingClass>(
  missingClass
);

/**
 * Provides the server-authorized first render and native reactive class data.
 */
export function ClassContextProvider({
  children,
  initialRoute,
}: {
  children: React.ReactNode;
  initialRoute: ClassContextValue;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const query = useQuery(
    refs.public.classes.queries.getClassRoute,
    isAuthenticated ? { classId: initialRoute.class._id } : "skip"
  );
  if (QueryResult.isFailure(query)) {
    throw query.error;
  }
  if (!(isLoading || isAuthenticated)) {
    return null;
  }
  const route = QueryResult.isSuccess(query) ? query.value : initialRoute;

  if (route.kind !== "accessible") {
    return null;
  }

  return (
    <ClassContext.Provider value={route}>{children}</ClassContext.Provider>
  );
}

/** Reads one selected value from the resolved class route snapshot. */
export function useClass<T>(selector: (state: ClassContextValue) => T) {
  const selected = useContextSelector(ClassContext, (value) =>
    value === missingClass ? missingClass : selector(value)
  );
  if (selected === missingClass) {
    throw new Error("useClass must be used within a ClassContextProvider");
  }
  return selected;
}
