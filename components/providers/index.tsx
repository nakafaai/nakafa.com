import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";

export function AppProviders({ children }: { children: ReactNode }) {
  return <JotaiProvider>{children}</JotaiProvider>;
}
