import type en from "./messages/en.json";
import type id from "./messages/id.json";
import type { PagefindSearchOptions } from "./types/pagefind";

type Messages = typeof id | typeof en;

declare global {
  // Use type safe message keys with `next-intl`
  type IntlMessages = Messages;
  interface Window {
    pagefind: {
      options: (options: unknown) => void;
      debouncedSearch: <T>(
        query: string,
        searchOptions: PagefindSearchOptions
      ) => Promise<T[]>;
    };
  }
}
