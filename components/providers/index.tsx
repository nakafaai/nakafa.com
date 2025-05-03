import { PagefindProvider } from "@/lib/context/use-pagefind";
import { Provider as JotaiProvider } from "jotai";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { ReactQueryProviders } from "./react-query";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NuqsAdapter>
      <JotaiProvider>
        <ReactQueryProviders>
          <PagefindProvider>{children}</PagefindProvider>
        </ReactQueryProviders>
      </JotaiProvider>
    </NuqsAdapter>
  );
}
