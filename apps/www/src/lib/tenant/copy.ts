import type { Locale } from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createTranslator } from "use-intl";

/** The sign-in line of a school's entry surface, in the reader's locale. */
export async function readSchoolSignInTitle(locale: Locale, school: string) {
  const messages = await loadLocaleMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "School" });
  return t("sign-in-title", { school });
}
