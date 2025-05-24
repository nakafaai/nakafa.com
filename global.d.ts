import type { PagefindSearchOptions } from "./types/pagefind";

import type { formats } from "@/i18n/request";
import type { routing } from "@/i18n/routing";
import type messages from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
    Formats: typeof formats;
  }
}

declare global {
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
