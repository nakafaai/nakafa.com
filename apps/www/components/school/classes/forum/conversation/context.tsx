import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { createContext, type ReactNode, use } from "react";
import type { Forum } from "@/components/school/classes/forum/conversation/data/entities";

/** Props of the forum data provider: `value` is one forum-scoped data snapshot. */
interface DataProviderProps {
  children: ReactNode;
  value: {
    currentUserId: Id<"users">;
    forum: Forum | undefined;
    forumId: Id<"schoolClassForums">;
  };
}

type DataValue = DataProviderProps["value"];

const DataContext = createContext<DataValue | null>(null);

/** Provides one forum-scoped immutable data snapshot. */
export function DataProvider({ children, value }: DataProviderProps) {
  return <DataContext value={value}>{children}</DataContext>;
}

/** Reads one selected value from immutable forum conversation data. */
export function useData<T>(selector: (state: DataValue) => T) {
  const value = use(DataContext);
  if (!value) {
    throw new Error("useData must be used within a ConversationProvider");
  }

  return selector(value);
}
