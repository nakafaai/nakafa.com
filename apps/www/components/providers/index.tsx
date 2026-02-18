import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ComponentProps, ReactNode } from "react";
import { AiContextProvider } from "@/lib/context/use-ai";
import { ContentViewsProvider } from "@/lib/context/use-content-views";
import { PagefindProvider } from "@/lib/context/use-pagefind";
import { SearchContextProvider } from "@/lib/context/use-search";
import { UserContextProvider } from "@/lib/context/use-user";
import { ConvexProvider } from "./convex";
import { ReactQueryProviders } from "./react-query";

export function AppProviders({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: ComponentProps<typeof ConvexProvider>["initialToken"];
}) {
  return (
    <ConvexProvider initialToken={initialToken}>
      <UserContextProvider>
        <SearchContextProvider>
          <NuqsAdapter>
            <ReactQueryProviders>
              <PagefindProvider>
                <ContentViewsProvider>
                  <AiContextProvider>{children}</AiContextProvider>
                </ContentViewsProvider>
              </PagefindProvider>
            </ReactQueryProviders>
          </NuqsAdapter>
        </SearchContextProvider>
      </UserContextProvider>
    </ConvexProvider>
  );
}
