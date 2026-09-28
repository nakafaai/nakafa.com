import type { ReactNode } from "react";
import { AiContextProvider } from "@/components/ai/context";
import { ContentViewsProvider } from "@/lib/content/views/context";
import { SearchContextProvider } from "@/lib/search/context";

/**
 * Mounts shared feature-state providers for the marketing, main, and tryout
 * route groups.
 *
 * These stores are intentionally scoped below the app-wide runtime providers so
 * `auth` and `school` stay free of unrelated search, AI, and content view
 * state.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 * @see https://nextjs.org/docs/app/guides/streaming
 */
export function SharedProviders({ children }: { children: ReactNode }) {
  return (
    <SearchContextProvider>
      <ContentViewsProvider>
        <AiContextProvider>{children}</AiContextProvider>
      </ContentViewsProvider>
    </SearchContextProvider>
  );
}
