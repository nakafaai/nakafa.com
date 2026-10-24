import { useLeafRoutePath } from "@repo/internationalization/src/link";
import { HOME_TARGET } from "@repo/internationalization/src/target";
import { useTranslations } from "use-intl";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { getUserSettingsSection } from "@/lib/settings/routes";

/**
 * Renders the sticky breadcrumb header for the settings section that owns the
 * page on screen, under the group that holds it.
 */
export function UserSettingsHeader() {
  const leafPath = useLeafRoutePath();
  const t = useTranslations("Auth");
  const tCommon = useTranslations("Common");
  const section = getUserSettingsSection(leafPath);
  const label = t(section.labelKey);

  return (
    <BreadcrumbHeader
      value={{
        home: { host: "app", target: HOME_TARGET },
        homeLabel: tCommon("home"),
        items: [
          {
            label: t(section.group.key),
            target: { host: "app", target: section.group.target },
          },
          { label },
        ],
        menuLabel: tCommon("more"),
        title: label,
      }}
    />
  );
}
