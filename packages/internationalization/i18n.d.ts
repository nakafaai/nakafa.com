import messages from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import type { formats } from "@repo/internationalization/src/request";
import type { routing } from "@repo/internationalization/src/routing";

declare module "next-intl" {
  interface AppConfig {
    Formats: typeof formats;
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
