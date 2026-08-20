import messages from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import type { formats } from "@repo/internationalization/src/request";
import type { previewRouting } from "@repo/internationalization/src/routing";

declare module "next-intl" {
  interface AppConfig {
    Formats: typeof formats;
    Locale: (typeof previewRouting.locales)[number];
    Messages: typeof messages;
  }
}
