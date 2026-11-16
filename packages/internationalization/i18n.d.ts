import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import messages from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import standalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import type { FORMATS } from "@repo/internationalization/src/formats";

declare module "use-intl" {
  interface AppConfig {
    Formats: typeof FORMATS;
    Locale: ActiveAppLocaleCode;
    Messages: typeof messages & typeof standalone;
  }
}
