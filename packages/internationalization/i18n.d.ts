import messages from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import standalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import type { formats } from "@repo/internationalization/src/request";
import type { previewRouting } from "@repo/internationalization/src/routing";

declare module "use-intl" {
  interface AppConfig {
    Formats: typeof formats;
    Locale: (typeof previewRouting.locales)[number];
    Messages: typeof messages & typeof standalone;
  }
}
