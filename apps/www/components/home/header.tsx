"use client";

import { useTranslations } from "next-intl";
import { useViewer } from "@/lib/identity/client";

/**
 * Renders the home greeting.
 *
 * Selects the projected viewer so a route that seeded its account shows the
 * real name on the first paint instead of an interim guest label.
 */
export function HomeHeader() {
  const t = useTranslations("Home");
  const name = useViewer((state) => state.viewer?.name ?? t("guest"));

  return (
    <div className="flex flex-col gap-2">
      <p>{t("greeting", { name })}</p>
      <h1 className="text-pretty font-medium text-4xl tracking-tight">
        {t("title")}
      </h1>
    </div>
  );
}
