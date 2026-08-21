"use client";

import type { ReactNode } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import type { PageNavigation } from "@/lib/content/page/navigation";

const missingPageNavigation = Symbol("PageNavigation");
const PageNavigationContext = createContext<
  PageNavigation | null | typeof missingPageNavigation
>(missingPageNavigation);

/** Provides release-verified Page destinations to client application shells. */
export function PageNavigationProvider({
  children,
  navigation,
}: {
  readonly children: ReactNode;
  readonly navigation: PageNavigation | null;
}) {
  return (
    <PageNavigationContext.Provider value={navigation}>
      {children}
    </PageNavigationContext.Provider>
  );
}

/** Reads one derived slice from the current release-verified Page catalog. */
export function usePageNavigation<T>(
  selector: (navigation: PageNavigation | null) => T
) {
  const selected = useContextSelector(PageNavigationContext, (navigation) =>
    navigation === missingPageNavigation
      ? missingPageNavigation
      : selector(navigation)
  );
  if (selected === missingPageNavigation) {
    throw new Error(
      "usePageNavigation must be used within PageNavigationProvider"
    );
  }
  return selected;
}
