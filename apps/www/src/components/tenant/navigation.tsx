import {
  Certificate01Icon,
  MortarboardIcon,
  Notification01Icon,
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
import { showsStudentHome } from "@/components/tenant/home/access";
import { SchoolSettingsNav } from "@/components/tenant/settings/nav";
import { Link, useRouteMatched } from "@/lib/routing/link";

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
 * The school's own groups, as the learner's sidebar has them: first the main pages with no label,
 * the notifications for everyone, a student's own exams, the exams, the report cards, and the
 * graduation for a viewer who may open them, then the management group, with the settings entry, only for a viewer who may
 * manage the school. The school has no home of its own: its root opens the viewer's main page. The
 * viewer's classes come last, when the viewer has any, so they never move the groups above them.
 */
function TenantSchoolGroups() {
  const tenant = useTenant();
  const { canManage, canOpenExams, canOpenGraduation, canOpenReports, slug } =
    tenant;
  const matchRoute = useMatchRoute();
  const tExams = useTranslations("Exams");
  const tNotifications = useTranslations("Notifications");
  const tGraduation = useTranslations("SchoolGraduation");
  const tReports = useTranslations("SchoolReports");
  const tSettings = useTranslations("SchoolSettings");

  return (
    <>
      <TenantSidebarGroup>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={
              matchRoute({
                params: { slug },
                to: "/school/$slug/notifications",
              }) !== false
            }
            render={<Link params={{ slug }} to="/school/$slug/notifications" />}
            tooltip={tNotifications("title")}
          >
            <HugeIcons icon={Notification01Icon} />
            <span className="truncate">{tNotifications("title")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {showsStudentHome(tenant, tenant.home) ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                matchRoute({
                  fuzzy: true,
                  params: { slug },
                  to: "/school/$slug/sittings",
                }) !== false
              }
              render={<Link params={{ slug }} to="/school/$slug/sittings" />}
              tooltip={tExams("title")}
            >
              <HugeIcons icon={TaskEdit01Icon} />
              <span className="truncate">{tExams("title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
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
        {canOpenReports ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                matchRoute({
                  fuzzy: true,
                  params: { slug },
                  to: "/school/$slug/reports",
                }) !== false
              }
              render={<Link params={{ slug }} to="/school/$slug/reports" />}
              tooltip={tReports("title")}
            >
              <HugeIcons icon={Certificate01Icon} />
              <span className="truncate">{tReports("title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {canOpenGraduation ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                matchRoute({
                  fuzzy: true,
                  params: { slug },
                  to: "/school/$slug/graduation",
                }) !== false
              }
              render={<Link params={{ slug }} to="/school/$slug/graduation" />}
              tooltip={tGraduation("title")}
            >
              <HugeIcons icon={MortarboardIcon} />
              <span className="truncate">{tGraduation("title")}</span>
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
