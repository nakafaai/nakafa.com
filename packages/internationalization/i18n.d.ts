import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import messages from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import standalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};

declare module "use-intl" {
  interface AppConfig {
    Locale: AppLocaleCode;
    Messages: typeof messages & typeof standalone;
  }
}
