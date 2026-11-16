import { useRequired } from "@repo/design-system/hooks/required";
import { createContext, type ReactNode, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import type { GraphDraft } from "@/components/tenant/exams/figure/graph/draft";
import {
  createGraphStore,
  type GraphState,
} from "@/components/tenant/exams/figure/graph/store";

const BuilderContext = createContext<StoreApi<GraphState> | null>(null);

/**
 * Holds the builder of one figure dialog, created once from the graph it opens on, and tells `write` of every graph
 * the teacher makes, so the dialog saves the last one.
 */
export function GraphProvider({
  children,
  draft,
  write,
}: {
  readonly children: ReactNode;
  readonly draft: GraphDraft;
  readonly write: (draft: GraphDraft) => void;
}) {
  const [store] = useState(() => createGraphStore(draft, write));

  return <BuilderContext value={store}>{children}</BuilderContext>;
}

/** Reads one selected slice of the figure being written. */
export function useGraph<T>(selector: (state: GraphState) => T) {
  const store = useRequired(BuilderContext, "useGraph");

  return useStore(store, selector);
}
