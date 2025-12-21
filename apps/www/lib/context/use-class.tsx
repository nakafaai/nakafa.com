"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { createContext, useContextSelector } from "use-context-selector";

interface ClassContextValue {
  class: Doc<"schoolClasses">;
  classMembership: Doc<"schoolClassMembers"> | null;
  schoolMembership: Doc<"schoolMembers"> | null;
}

const ClassContext = createContext<ClassContextValue | null>(null);

export function ClassContextProvider({
  children,
  classId,
}: {
  children: React.ReactNode;
  classId: Id<"schoolClasses">;
}) {
  const results = useQuery(api.classes.queries.getClass, {
    classId,
  });

  const classData = results?.class;
  const classMembership = results?.classMembership ?? null;
  const schoolMembership = results?.schoolMembership ?? null;

  if (!(classData && schoolMembership)) {
    return null;
  }

  return (
    <ClassContext.Provider
      value={{ class: classData, classMembership, schoolMembership }}
    >
      {children}
    </ClassContext.Provider>
  );
}

export function useClass<T>(selector: (state: ClassContextValue) => T) {
  const context = useContextSelector(ClassContext, (value) => value);
  if (!context) {
    throw new Error("useClass must be used within a ClassContextProvider");
  }
  return selector(context);
}
