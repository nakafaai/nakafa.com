import { useTranslations } from "next-intl";

/**
 * Shows the title and the sentence that open the sign-in page: what the page is
 * for, and why signing in keeps the learner's progress saved.
 */
export function AuthTitle() {
  const t = useTranslations("Auth");

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="font-semibold text-2xl">{t("sign-in-title")}</h1>
      <p className="text-muted-foreground">{t("sign-in-description")}</p>
    </div>
  );
}
