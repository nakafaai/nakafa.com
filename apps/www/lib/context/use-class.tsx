"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { type Preloaded, usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContextSelector } from "use-context-selector";

type ClassContextValue = Extract<
  FunctionReturnType<typeof api.classes.queries.getClassRoute>,
  { kind: "accessible" }
>;

const ClassContext = createContext<ClassContextValue | null>(null);

/**
 * Hydrate and provide the reactive class route to the class client subtree.
 */
export function ClassContextProvider({
  children,
  preloaded,
}: {
  children: React.ReactNode;
  preloaded: Preloaded<typeof api.classes.queries.getClassRoute>;
}) {
  const route = usePreloadedQuery(preloaded);

  if (route.kind !== "accessible") {
    return null;
  }

  return (
    <ClassContext.Provider value={route}>{children}</ClassContext.Provider>
  );
}

/** Reads one selected value from the resolved class route snapshot. */
export function useClass<T>(selector: (state: ClassContextValue) => T) {
  const context = useContextSelector(ClassContext, (value) => value);
  if (!context) {
    throw new Error("useClass must be used within a ClassContextProvider");
  }
  return selector(context);
}
