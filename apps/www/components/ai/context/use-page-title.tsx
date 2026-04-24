"use client";

import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";

const PageTitleContext = createContext<string | null>(null);

/** Provides the current learning page title to Nina entry points. */
export function PageTitleProvider({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <PageTitleContext.Provider value={title}>
      {children}
    </PageTitleContext.Provider>
  );
}

/** Reads the current learning page title for Nina suggestions. */
export function usePageTitle() {
  const title = useContextSelector(PageTitleContext, (value) => value);
  if (title === null) {
    throw new Error("usePageTitle must be used within PageTitleProvider");
  }
  return title;
}
