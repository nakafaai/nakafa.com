"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { createContext, useContextSelector } from "use-context-selector";

type ClassContextValue = Extract<
  FunctionReturnType<typeof api.classes.queries.getClassRoute>,
  { kind: "accessible" }
>;

const ClassContext = createContext<ClassContextValue | null>(null);

/**
 * Provide the resolved class route snapshot to the class client subtree.
 */
export function ClassContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ClassContextValue;
}) {
  return (
    <ClassContext.Provider value={value}>{children}</ClassContext.Provider>
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
