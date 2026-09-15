"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { getUserSettingsSection } from "@/lib/settings/routes";

/**
 * Renders the sticky breadcrumb header for the settings section that owns the
 * current pathname.
 */
export function UserSettingsHeader() {
  const pathname = usePathname();
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const label = t(getUserSettingsSection(pathname).labelKey);

  return (
    <BreadcrumbHeader
      value={{
        homeLabel: tCommon("home"),
        items: [{ label }],
        menuLabel: tCommon("more"),
        title: label,
      }}
    />
  );
}
