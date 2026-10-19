import { useTranslations } from "use-intl";

/** Renders the greeting of the signed-in visitor, including its first paint. */
export function HomeHeader({ name }: { name: string | null }) {
  const t = useTranslations("Home");

  return (
    <div className="flex flex-col gap-2">
      <p>{t("greeting", { name: name ?? t("guest") })}</p>
      <h1 className="text-pretty font-medium text-4xl tracking-tight">
        {t("title")}
      </h1>
    </div>
  );
}
