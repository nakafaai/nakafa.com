"use client";

import { type ReactNode, useRef } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createExerciseStore, type ExerciseStore } from "@/lib/store/exercise";

type ExerciseStoreApi = ReturnType<typeof createExerciseStore>;

export const ExerciseContext = createContext<ExerciseStoreApi | null>(null);

export function ExerciseContextProvider({
  children,
  slug,
}: {
  children: ReactNode;
  slug: string;
}) {
  const storeRef = useRef<ExerciseStoreApi>(undefined);

  if (!storeRef.current) {
    storeRef.current = createExerciseStore({
      slug,
    });
  }

  return (
    <ExerciseContext.Provider value={storeRef.current}>
      {children}
    </ExerciseContext.Provider>
  );
}

export function useExercise<T>(selector: (state: ExerciseStore) => T): T {
  const ctx = useContextSelector(ExerciseContext, (context) => context);
  if (!ctx) {
    throw new Error(
      "useExercise must be used within a ExerciseContextProvider"
    );
  }
  return useStore(ctx, useShallow(selector));
}
