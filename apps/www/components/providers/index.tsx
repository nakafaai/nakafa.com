import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import { AiContextProvider } from "@/lib/context/use-ai";
import { PagefindProvider } from "@/lib/context/use-pagefind";
import { SearchContextProvider } from "@/lib/context/use-search";
import { ConvexProvider } from "./convex";
import { ReactQueryProviders } from "./react-query";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider>
      <SearchContextProvider>
        <NuqsAdapter>
          <ReactQueryProviders>
            <PagefindProvider>
              <AiContextProvider>{children}</AiContextProvider>
            </PagefindProvider>
          </ReactQueryProviders>
        </NuqsAdapter>
      </SearchContextProvider>
    </ConvexProvider>
  );
}
