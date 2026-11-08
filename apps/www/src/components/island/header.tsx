import { useTranslations } from "use-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { HOME_TARGET } from "@/lib/routing/target";

/** The sticky breadcrumb header of the island page, as every account page has it. */
export function IslandHeader() {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  return (
    <BreadcrumbHeader
      value={{
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [{ label: t("title") }],
        title: t("title"),
      }}
    />
  );
}
