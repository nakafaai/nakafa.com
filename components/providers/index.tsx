import { PagefindProvider } from "@/lib/context/use-pagefind";
import { SearchContextProvider } from "@/lib/context/use-search";
import { TocProvider } from "@/lib/context/use-toc";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { ReactQueryProviders } from "./react-query";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SearchContextProvider>
      <NuqsAdapter>
        <ReactQueryProviders>
          <PagefindProvider>
            <TocProvider>{children}</TocProvider>
          </PagefindProvider>
        </ReactQueryProviders>
      </NuqsAdapter>
    </SearchContextProvider>
  );
}
