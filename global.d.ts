import type { PagefindSearchOptions } from "./types/pagefind";

import type { routing } from "@/i18n/navigation";
import type { formats } from "@/i18n/request";
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
    pagefind: {
      options: (options: unknown) => void;
      debouncedSearch: <T>(
        query: string,
        searchOptions: PagefindSearchOptions
      ) => Promise<T[]>;
      destroy?: () => Promise<void>;
      init?: () => Promise<void>;
    };
  }
}
