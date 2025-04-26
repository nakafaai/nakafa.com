import { Provider as JotaiProvider } from "jotai";
import type { ReactNode } from "react";
import { ReactQueryProviders } from "./react-query";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <JotaiProvider>
      <ReactQueryProviders>{children}</ReactQueryProviders>
    </JotaiProvider>
  );
}
