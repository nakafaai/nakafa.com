import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { SettingsBack } from "@/components/shared/settings/return";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { settingsSectionIcons } from "@/components/tenant/settings/icons";
import { TargetLink, useLeafRoutePath } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";
import {
  type SchoolSettingsGroup,
  schoolSettingsGroups,
} from "@/lib/settings/school";

/**
 * Renders the school settings as the sidebar body for settings routes, replacing the
 * school's own navigation without replacing the shell: a first row back to the school
 * page the viewer came from (or the school's home), then one labelled group for each
 * group of settings (School, People, Integrations, Security) that lists its sections, as
 * the learner's own settings do. A school host has no locale in its paths, so the links
 * are school links, as in the school's own navigation.
 */
export function SchoolSettingsNav() {
  const { name, slug } = useTenant();
  const t = useTranslations("SchoolSettings");

  return (
    <>
      <SettingsBack
        home={{ from: LOCALE_ROUTE, params: { slug }, to: "/school/$slug" }}
        label={t("back-to-school", { school: name })}
      />
      {Arr.map(schoolSettingsGroups(slug), (group) => (
        <SchoolSettingsNavGroup group={group} key={group.key} />
      ))}
    </>
  );
}

/** One group of school settings: its name as the label, then its sections. */
function SchoolSettingsNavGroup({ group }: { group: SchoolSettingsGroup }) {
  const t = useTranslations("SchoolSettings");

  return (
    <TenantSidebarGroup label={t(group.key)}>
      {Arr.map(group.sections, (section) => (
        <SchoolSettingsNavItem key={section.target.to} section={section} />
      ))}
    </TenantSidebarGroup>
  );
}

/** One section of school settings, active on its own page. */
function SchoolSettingsNavItem({
  section,
}: {
  section: SchoolSettingsGroup["sections"][number];
}) {
  const leafPath = useLeafRoutePath();
  const t = useTranslations("SchoolSettings");
  const label = t(section.labelKey);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={section.target.to === leafPath}
        render={<TargetLink target={section.target} />}
        tooltip={label}
      >
        <HugeIcons icon={settingsSectionIcons[section.labelKey]} />
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
