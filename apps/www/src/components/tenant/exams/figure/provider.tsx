import { createContext, type ReactNode, use, useState } from "react";
import { type StoreApi, useStore } from "zustand";
import type { FigureDraft } from "@/components/tenant/exams/figure/draft";
import {
  createFigureBuilder,
  type FigureBuilder,
} from "@/components/tenant/exams/figure/store";

const BuilderContext = createContext<StoreApi<FigureBuilder> | null>(null);

/** Holds the builder of one figure dialog, created once from the figure it opens on. */
export function FigureProvider({
  children,
  draft,
}: {
  readonly children: ReactNode;
  readonly draft: FigureDraft;
}) {
  const [store] = useState(() => createFigureBuilder(draft));

  return <BuilderContext value={store}>{children}</BuilderContext>;
}

/** Reads one selected slice of the figure being written. */
export function useFigure<T>(selector: (state: FigureBuilder) => T) {
  const store = use(BuilderContext);

  if (store === null) {
    throw new Error("useFigure must be used within FigureProvider");
  }

  return useStore(store, selector);
}
