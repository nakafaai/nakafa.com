import type { ReactNode } from "react";
import { AiContextProvider } from "@/components/ai/context/use-ai";
import { ContentViewsProvider } from "@/lib/context/use-content-views";
import { PagefindProvider } from "@/lib/context/use-pagefind";
import { SearchContextProvider } from "@/lib/context/use-search";

/**
 * Mounts shared feature-state providers for the marketing, main, and tryout
 * route groups.
 *
 * These stores are intentionally scoped below the app-wide runtime providers so
 * `auth` and `school` stay free of unrelated search, Pagefind, AI, and content
 * view state.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 * @see https://nextjs.org/docs/app/guides/streaming
 */
export function SharedProviders({ children }: { children: ReactNode }) {
  return (
    <SearchContextProvider>
      <PagefindProvider>
        <ContentViewsProvider>
          <AiContextProvider>{children}</AiContextProvider>
        </ContentViewsProvider>
      </PagefindProvider>
    </SearchContextProvider>
  );
}
