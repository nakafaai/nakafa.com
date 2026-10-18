"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { getSchoolSettingsSection } from "@/lib/settings/school";

/**
 * Renders the sticky breadcrumb header for the school settings section that owns
 * the current pathname, under the group that holds it.
 */
export function SchoolSettingsHeader() {
  const pathname = usePathname();
  const t = useTranslations("SchoolSettings");
  const tCommon = useTranslations("Common");
  const section = getSchoolSettingsSection(pathname);
  const label = t(section.labelKey);

  return (
    <BreadcrumbHeader
      value={{
        homeHref: "/",
        homeLabel: tCommon("home"),
        items: [
          { href: section.group.href, label: t(section.group.key) },
          { label },
        ],
        menuLabel: tCommon("more"),
        title: label,
      }}
    />
  );
}
