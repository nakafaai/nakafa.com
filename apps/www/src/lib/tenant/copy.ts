import type { Locale } from "@repo/internationalization/src/locale";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createTranslator } from "use-intl/core";

/**
 * The sign-in line of a school's entry surface in the reader's locale, for the school's name. The messages load
 * before the name is known, so a visitor's read loads them beside the school's profile.
 */
export async function loadSchoolSignInTitle(locale: Locale) {
  const messages = await loadLocaleMessages(locale);
  const t = createTranslator({ locale, messages, namespace: "School" });
  return (school: string) => t("sign-in-title", { school });
}
