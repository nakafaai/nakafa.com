import { useTranslations } from "next-intl";

/** Renders the Nakafa title block shared by the sign-in screens. */
export function AuthTitle() {
  const t = useTranslations("Metadata");

  return (
    <div className="flex flex-col items-center">
      <h1 className="font-semibold text-2xl">Nakafa</h1>
      <p className="text-muted-foreground">{t("very-short-description")}</p>
    </div>
  );
}
