import {
  ArrowRight01Icon,
  Building03Icon,
  Calendar03Icon,
  CreditCardIcon,
  DocumentValidationIcon,
  FileSpreadsheetIcon,
  InformationCircleIcon,
  Link01Icon,
  Mail01Icon,
  Plug01Icon,
  School01Icon,
  SecurityCheckIcon,
  SecurityLockIcon,
  StudentIcon,
  UserGroupIcon,
  UserLove01Icon,
  UserMultiple02Icon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
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
import { type ComponentProps, useState } from "react";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { TargetLink, useLeafRoutePath } from "@/lib/routing/link";
import {
  type SchoolSettingsGroup,
  schoolSettingsGroups,
} from "@/lib/settings/school";

/** The icon of each group. A group added without one does not compile. */
const groupIcons: Record<
  SchoolSettingsGroup["key"],
  ComponentProps<typeof HugeIcons>["icon"]
> = {
  integrations: Link01Icon,
  people: UserGroupIcon,
  school: School01Icon,
  security: SecurityLockIcon,
};

/** The icon of each section, beside its name. A section added without one does not compile. */
const sectionIcons: Record<
  SchoolSettingsGroup["sections"][number]["labelKey"],
  ComponentProps<typeof HugeIcons>["icon"]
> = {
  audit: DocumentValidationIcon,
  billing: CreditCardIcon,
  clients: Plug01Icon,
  cohorts: UserMultiple02Icon,
  guardians: UserLove01Icon,
  invites: Mail01Icon,
  members: UserGroupIcon,
  periods: Calendar03Icon,
  policies: SecurityCheckIcon,
  profile: InformationCircleIcon,
  roles: UserSettings01Icon,
  roster: FileSpreadsheetIcon,
  students: StudentIcon,
  units: Building03Icon,
};

/**
 * Renders the school settings as the sidebar body for settings routes, replacing the
 * school's own navigation without replacing the shell: one Settings group whose
 * groups fold open into their sections, as shadcn's sidebar draws a menu with
 * submenus. The group that holds the current section opens, also when the current
 * section moves into it, as after the settings root sends the viewer to its first
 * section, or a link opens a section of another group; a group never closes by itself. A school host
 * has no locale in its paths, so the links are school links, as in the
 * school's own navigation.
 */
export function SchoolSettingsNav() {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");

  return (
    <TenantSidebarGroup label={t("manage-settings")}>
      {Arr.map(schoolSettingsGroups(slug), (group) => (
        <SchoolSettingsNavGroup group={group} key={group.key} />
      ))}
    </TenantSidebarGroup>
  );
}

/** One group of school settings: its name, which folds open into its sections. */
function SchoolSettingsNavGroup({ group }: { group: SchoolSettingsGroup }) {
  const leafPath = useLeafRoutePath();
  const t = useTranslations("SchoolSettings");
  const label = t(group.key);
  const isSectionActive = (section: (typeof group.sections)[number]) =>
    section.target.to === leafPath;
  const holdsCurrent = Arr.some(group.sections, isSectionActive);
  const [open, setOpen] = useState(holdsCurrent);
  const [heldCurrent, setHeldCurrent] = useState(holdsCurrent);

  // The group opens when the current section moves into it. It never closes by itself
  // when the current section moves out, so the groups under the pointer stay in place;
  // only the viewer folds a group.
  if (holdsCurrent !== heldCurrent) {
    setHeldCurrent(holdsCurrent);
    if (holdsCurrent) {
      setOpen(true);
    }
  }

  return (
    <Collapsible
      className="group/collapsible"
      onOpenChange={setOpen}
      open={open}
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={label} />}>
        <HugeIcons icon={groupIcons[group.key]} />
        <span className="truncate">{label}</span>
        <HugeIcons
          className="ms-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
          icon={ArrowRight01Icon}
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <SidebarMenuSub>
          {Arr.map(group.sections, (section) => (
            <SidebarMenuSubItem key={section.target.to}>
              <SidebarMenuSubButton
                isActive={isSectionActive(section)}
                render={<TargetLink target={section.target} />}
              >
                <HugeIcons icon={sectionIcons[section.labelKey]} />
                <span className="truncate">{t(section.labelKey)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsiblePanel>
    </Collapsible>
  );
}
