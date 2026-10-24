import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { useLeafRoutePath } from "@/lib/routing/link";
import { getSchoolSettingsSection } from "@/lib/settings/school";

/**
 * The header of the school settings: the path to the section that owns the current
 * pathname, under the group that holds it, in the school's one header row, and the
 * section's own action at its end.
 */
export function SchoolSettingsHeader({ children }: { children?: ReactNode }) {
  const leafPath = useLeafRoutePath();
  const tenant = useTenant();
  const t = useTranslations("SchoolSettings");
  const section = getSchoolSettingsSection(tenant.slug, leafPath);
  const label = t(section.labelKey);

  return (
    <SchoolHeader
      items={[
        {
          label: t(section.group.key),
          target: section.group.target,
        },
        { label },
      ]}
      title={label}
    >
      {children}
    </SchoolHeader>
  );
}
