"use client";

import { createContext, type ReactNode, use } from "react";
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
    <PageNavigationContext value={navigation}>{children}</PageNavigationContext>
  );
}

/** Reads one derived slice from the current release-verified Page catalog. */
export function usePageNavigation<T>(
  selector: (navigation: PageNavigation | null) => T
) {
  const navigation = use(PageNavigationContext);
  if (navigation === missingPageNavigation) {
    throw new Error(
      "usePageNavigation must be used within PageNavigationProvider"
    );
  }
  return selector(navigation);
}
