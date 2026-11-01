import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { useLeafRoutePath } from "@/lib/routing/link";
import { HOME_TARGET } from "@/lib/routing/target";
import { getUserSettingsSection } from "@/lib/settings/routes";

/**
 * Renders the sticky breadcrumb header for the settings section that owns the
 * page on screen, under the group that holds it, and the section's own controls
 * at its end.
 */
export function UserSettingsHeader({ children }: { children?: ReactNode }) {
  const leafPath = useLeafRoutePath();
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const section = getUserSettingsSection(leafPath);
  const label = t(section.labelKey);

  return (
    <BreadcrumbHeader
      value={{
        action: children,
        home: HOME_TARGET,
        homeLabel: tCommon("home"),
        items: [
          {
            label: t(section.group.key),
            target: section.group.target,
          },
          { label },
        ],
        title: label,
      }}
    />
  );
}
