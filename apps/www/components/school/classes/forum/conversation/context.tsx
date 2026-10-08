import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { forumDetailValidator } from "@repo/backend/confect/classes/forums/validators";
import { Schema } from "effect";
import { createContext, type ReactNode, use } from "react";

const DataValueSchema = Schema.Struct({
  currentUserId: IdSchema("users"),
  forum: Schema.UndefinedOr(forumDetailValidator),
  forumId: IdSchema("schoolClassForums"),
});

type DataValue = typeof DataValueSchema.Type;

const DataContext = createContext<DataValue | null>(null);

/** Provides one forum-scoped immutable data snapshot. */
export function DataProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: DataValue;
}) {
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
