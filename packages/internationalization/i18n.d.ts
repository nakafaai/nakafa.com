import messages from "./dictionaries/en.json" with { type: "json" };
import type { formats } from "./src/request";
import type { routing } from "./src/routing";

declare module "next-intl" {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Must use interface
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
    Formats: typeof formats;
  }
}
