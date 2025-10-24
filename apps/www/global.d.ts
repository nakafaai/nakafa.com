import type { PagefindSearchOptions } from "./types/pagefind";

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Must use interface
  interface Window {
    pagefind:
      | {
          debouncedSearch: <T>(
            term: string,
            options?: PagefindSearchOptions,
            debounceTimeoutMs?: number
          ) => Promise<{
            results: {
              data: () => Promise<T>;
              id: string;
            }[];
          } | null>;
          options: (opts: Record<string, unknown>) => Promise<void>;
          destroy?: () => Promise<void>;
          init?: () => Promise<void>;
        }
      | undefined;
  }
}
