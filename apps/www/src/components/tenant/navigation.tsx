import {
  Home01Icon,
  Settings01Icon,
  TaskEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useMatchRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { SettingsReturnProvider } from "@/components/shared/settings/return";
import { TenantClassesGroup } from "@/components/tenant/classes/nav";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { SchoolSettingsNav } from "@/components/tenant/settings/nav";
import { Link, useRouteMatched } from "@/lib/routing/link";
import { EXACT_ACTIVE_OPTIONS } from "@/lib/routing/tree";

/** The address under which every school settings section lives. */
const SETTINGS_PATH = "/school/$slug/settings";

/**
 * Renders the navigation of the school sidebar. The settings sections replace it
 * on a settings route for a viewer who may manage the school, and otherwise the
 * school's own groups show. It stays mounted from the page the viewer leaves into
 * settings, so it remembers that page for the settings' way back.
 */
export function TenantNavigation() {
  const { canManage } = useTenant();
  const isSettings = useRouteMatched(SETTINGS_PATH, { exact: false });

  return (
    <SettingsReturnProvider path={SETTINGS_PATH}>
      {canManage && isSettings ? <SchoolSettingsNav /> : <TenantSchoolGroups />}
    </SettingsReturnProvider>
  );
}

/**
 * The school's own groups: the exams for a viewer who may open them, then the
 * management group, with the settings entry, only for a viewer who may manage the
 * school. The viewer's classes come last, when the viewer has any, so they never
 * move the groups above them.
 */
function TenantSchoolGroups() {
  const { canManage, canOpenExams, slug } = useTenant();
  const matchRoute = useMatchRoute();
  const t = useTranslations("School");
  const tExams = useTranslations("Exams");
  const tSettings = useTranslations("SchoolSettings");

  return (
    <>
      <TenantSidebarGroup label={t("for-you")}>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={
              matchRoute({ params: { slug }, to: "/school/$slug" }) !== false
            }
            render={
              <Link
                activeOptions={EXACT_ACTIVE_OPTIONS}
                params={{ slug }}
                to="/school/$slug"
              />
            }
            tooltip={t("home")}
          >
            <HugeIcons icon={Home01Icon} />
            <span className="truncate">{t("home")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {canOpenExams ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                matchRoute({
                  fuzzy: true,
                  params: { slug },
                  to: "/school/$slug/exams",
                }) !== false
              }
              render={<Link params={{ slug }} to="/school/$slug/exams" />}
              tooltip={tExams("title")}
            >
              <HugeIcons icon={TaskEdit01Icon} />
              <span className="truncate">{tExams("title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
      </TenantSidebarGroup>
      {canManage ? (
        <TenantSidebarGroup label={tSettings("manage-group")}>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link params={{ slug }} to="/school/$slug/settings/profile" />
              }
              tooltip={tSettings("manage-settings")}
            >
              <HugeIcons icon={Settings01Icon} />
              <span className="truncate">{tSettings("manage-settings")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </TenantSidebarGroup>
      ) : null}
      <TenantClassesGroup />
    </>
  );
}
