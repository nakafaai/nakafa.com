"use client";

import { usePathname } from "@repo/internationalization/src/navigation";
import { useTranslations } from "next-intl";
import { SchoolHeader } from "@/components/tenant/header";
import { getSchoolSettingsSection } from "@/lib/settings/school";

/**
 * The header of the school settings: the path to the section that owns the current
 * pathname, under the group that holds it, in the school's one header row.
 */
export function SchoolSettingsHeader() {
  const pathname = usePathname();
  const t = useTranslations("SchoolSettings");
  const section = getSchoolSettingsSection(pathname);
  const label = t(section.labelKey);

  return (
    <SchoolHeader
      items={[
        { href: section.group.href, label: t(section.group.key) },
        { label },
      ]}
      title={label}
    />
  );
}
