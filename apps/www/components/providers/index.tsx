import { PagefindProvider } from "@/lib/context/use-pagefind";
import { SearchContextProvider } from "@/lib/context/use-search";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { ReactQueryProviders } from "./react-query";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SearchContextProvider>
      <NuqsAdapter>
        <ReactQueryProviders>
          <PagefindProvider>{children}</PagefindProvider>
        </ReactQueryProviders>
      </NuqsAdapter>
    </SearchContextProvider>
  );
}
