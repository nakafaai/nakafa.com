import { getTranslations } from "next-intl/server";

/** Renders the request's greeting on the server, including its first paint. */
export async function HomeHeader({ name }: { name: string | null }) {
  const t = await getTranslations("Home");

  return (
    <div className="flex flex-col gap-2">
      <p>{t("greeting", { name: name ?? t("guest") })}</p>
      <h1 className="text-pretty font-medium text-4xl tracking-tight">
        {t("title")}
      </h1>
    </div>
  );
}
