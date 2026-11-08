import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/design-system/components/ui/sidebar-submenu";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { SettingsBack } from "@/components/shared/settings/return";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import {
  settingsGroupIcons,
  settingsSectionIcons,
} from "@/components/tenant/settings/icons";
import { TenantSetupGroup } from "@/components/tenant/setup/item";
import { TargetLink, useLeafRoutePath } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";
import {
  openSettingsGroups,
  ownsLeafPath,
  type SchoolSettingsGroup,
} from "@/lib/settings/school";

/**
 * Renders the school settings as the sidebar body for settings routes, replacing the
 * school's own navigation without replacing the shell: a first row back to the school
 * page the viewer came from (or the school's home), the setup entry while setup is open,
 * then one menu. The school's profile and billing stand alone with their icons; every
 * other group (Academics, People, Integrations, Security) folds its sections under its
 * own name and icon, open while it holds the page on screen, so the sidebar fits without
 * scrolling. A school host has no locale in its paths, so the links are school links, as
 * in the school's own navigation.
 */
export function SchoolSettingsNav() {
  const { name, reach, slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const groups = openSettingsGroups(slug, reach);

  return (
    <>
      <SettingsBack
        home={{ from: LOCALE_ROUTE, params: { slug }, to: "/school/$slug" }}
        label={t("back-to-school", { school: name })}
      />
      <TenantSetupGroup />
      <TenantSidebarGroup>
        {Arr.map(
          Arr.flatMap(groups, (group: SchoolSettingsGroup) =>
            group.key === "school" ? group.sections : []
          ),
          (section) => (
            <SchoolSettingsNavItem key={section.target.to} section={section} />
          )
        )}
        {Arr.map(
          Arr.filter(
            groups,
            (group: SchoolSettingsGroup) => group.key !== "school"
          ),
          (group) => (
            <SchoolSettingsNavGroup group={group} key={group.key} />
          )
        )}
      </TenantSidebarGroup>
    </>
  );
}

/** One group of school settings that folds its sections under its name, open while it holds the page on screen. */
function SchoolSettingsNavGroup({ group }: { group: SchoolSettingsGroup }) {
  const leafPath = useLeafRoutePath();
  const t = useTranslations("SchoolSettings");
  const label = t(group.key);
  const holdsPage = Arr.some(group.sections, (section) =>
    ownsLeafPath(section, leafPath)
  );

  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen={holdsPage}>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              className="[&[data-panel-open]>svg:last-child]:rotate-90"
              tooltip={label}
            />
          }
        >
          <HugeIcons icon={settingsGroupIcons[group.key]} />
          <span className="truncate">{label}</span>
          <HugeIcons
            className="ml-auto transition-transform motion-reduce:transition-none"
            icon={ArrowRight01Icon}
          />
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SidebarMenuSub>
            {Arr.map(group.sections, (section) => (
              <SchoolSettingsNavSubItem
                key={section.target.to}
                section={section}
              />
            ))}
          </SidebarMenuSub>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarMenuItem>
  );
}

/** One section that stands alone in the sidebar with its icon, active on its own page. */
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
        isActive={ownsLeafPath(section, leafPath)}
        render={<TargetLink target={section.target} />}
        tooltip={label}
      >
        <HugeIcons icon={settingsSectionIcons[section.labelKey]} />
        <span className="truncate">{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** One section folded under its group, named without an icon, active on its own page. */
function SchoolSettingsNavSubItem({
  section,
}: {
  section: SchoolSettingsGroup["sections"][number];
}) {
  const leafPath = useLeafRoutePath();
  const t = useTranslations("SchoolSettings");

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={ownsLeafPath(section, leafPath)}
        render={<TargetLink target={section.target} />}
      >
        <span>{t(section.labelKey)}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
