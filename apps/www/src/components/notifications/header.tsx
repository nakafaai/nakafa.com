import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { HOME_TARGET } from "@/lib/routing/target";

/**
 * The sticky breadcrumb header of the inbox, as every account page has it, with the
 * inbox's actions, marking every row read and its preferences, at its end.
 */
export function NotificationsHeader({
  children,
}: {
  /** The inbox's actions. */
  children: ReactNode;
}) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbHeader
      value={{
        action: children,
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [{ label: t("title") }],
        title: t("title"),
      }}
    />
  );
}
