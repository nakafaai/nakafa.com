import { useTranslations } from "use-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { HOME_TARGET } from "@/lib/routing/target";

/**
 * The sticky breadcrumb header of an island page, as every account page has
 * it: the owner's own island, or the island a visit names.
 */
export function IslandHeader({ title }: { title?: string }) {
  const t = useTranslations("Island");
  const tCommon = useTranslations("Common");
  const label = title ?? t("title");
  return (
    <BreadcrumbHeader
      value={{
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [{ label }],
        title: label,
      }}
    />
  );
}
