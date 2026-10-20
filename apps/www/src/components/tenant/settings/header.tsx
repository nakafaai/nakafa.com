import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { SchoolHeader } from "@/components/tenant/header";
import { useSchoolPath } from "@/lib/routing/school/link";
import { getSchoolSettingsSection } from "@/lib/settings/school";

/**
 * The header of the school settings: the path to the section that owns the current
 * pathname, under the group that holds it, in the school's one header row, and the
 * section's own action at its end.
 */
export function SchoolSettingsHeader({ children }: { children?: ReactNode }) {
  const pathname = useSchoolPath();
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
    >
      {children}
    </SchoolHeader>
  );
}
