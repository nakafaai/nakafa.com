import messages from "./dictionaries/en.json" with { type: "json" };
import type { formats } from "./src/request";
import type { routing } from "./src/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
