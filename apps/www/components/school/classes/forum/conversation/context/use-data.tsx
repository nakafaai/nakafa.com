"use client";

import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";

interface DataValue {
  currentUserId: Id<"users">;
  forum: Forum | undefined;
  forumId: Id<"schoolClassForums">;
}

const DataContext = createContext<DataValue | null>(null);
const missingData = Symbol("missing conversation data");

/** Provides one forum-scoped immutable data snapshot. */
export function DataProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: DataValue;
}) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Reads one selected value from immutable forum conversation data. */
export function useData<T>(selector: (state: DataValue) => T) {
  const selected = useContextSelector(DataContext, (value) =>
    value ? selector(value) : missingData
  );

  if (selected === missingData) {
    throw new Error("useData must be used within a ConversationProvider");
  }

  return selected;
}
