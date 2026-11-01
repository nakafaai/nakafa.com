import {
  Analytics01Icon,
  Certificate01Icon,
  ChartBarLineIcon,
  MortarboardIcon,
  Notification01Icon,
  Settings01Icon,
  TaskEdit01Icon,
  UserLove01Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useMatchRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { SettingsReturnProvider } from "@/components/shared/settings/return";
import { TenantClassesGroup } from "@/components/tenant/classes/nav";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { showsStudentHome } from "@/components/tenant/home/access";
import { SchoolSettingsNav } from "@/components/tenant/settings/nav";
import { TenantSetupItem } from "@/components/tenant/setup/item";
import { Link, TargetLink, useRouteMatched } from "@/lib/routing/link";
import { firstSettingsTarget } from "@/lib/settings/school";

/** The address under which every school settings section lives. */
const SETTINGS_PATH = "/school/$slug/settings";

/**
 * Renders the navigation of the school sidebar. The settings sections replace it
 * on a settings route for a viewer who opens any of them, and otherwise the school's
 * own groups show. It stays mounted from the page the viewer leaves into
 * settings, so it remembers that page for the settings' way back. The school's own
 * groups stay mounted behind the settings sections, so the classes keep their rows
 * and their live reads, and the way back draws them at once.
 */
export function TenantNavigation() {
  const { reach, slug } = useTenant();
  const isSettings = useRouteMatched(SETTINGS_PATH, { exact: false });
  const opensSettings = Option.isSome(firstSettingsTarget(slug, reach));
  const showsSettings = opensSettings && isSettings;

  return (
    <SettingsReturnProvider path={SETTINGS_PATH}>
      <div className={showsSettings ? "hidden" : "contents"}>
        <TenantSchoolGroups />
      </div>
      {showsSettings ? <SchoolSettingsNav /> : null}
    </SettingsReturnProvider>
  );
}

/**
 * The school's own groups, as the learner's sidebar has them: first the main pages with no label,
 * the notifications for everyone, a student's own exams, grades and report cards, the exams, the
 * school's report cards, and the graduation for a viewer who may open them, then the management
 * group, with the settings entry, only for a viewer who opens a section of the settings. The school has no
 * home of its own: its root opens the viewer's main page. The viewer's classes come last, when the
 * viewer has any, so they never move the groups above them.
 */
function TenantSchoolGroups() {
  const tenant = useTenant();
  const {
    canOpenExams,
    canOpenGraduation,
    canOpenInsight,
    canOpenReports,
    home,
    reach,
    role,
    slug,
  } = tenant;
  const settings = firstSettingsTarget(slug, reach);
  const matchRoute = useMatchRoute();
  const tExams = useTranslations("Exams");
  const tGrades = useTranslations("SchoolGrades");
  const tGuardians = useTranslations("SchoolGuardians");
  const tInsight = useTranslations("SchoolInsight");
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
        {Option.contains(role, "guardian") ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                matchRoute({
                  params: { slug },
                  to: "/school/$slug/parents",
                }) !== false
              }
              render={<Link params={{ slug }} to="/school/$slug/parents" />}
              tooltip={tGuardians("home-title")}
            >
              <HugeIcons icon={UserLove01Icon} />
              <span className="truncate">{tGuardians("home-title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {Option.contains(role, "student") ? (
          <>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={
                  matchRoute({
                    params: { slug },
                    to: "/school/$slug/family",
                  }) !== false
                }
                render={<Link params={{ slug }} to="/school/$slug/family" />}
                tooltip={tGuardians("family-title")}
              >
                <HugeIcons icon={UserLove01Icon} />
                <span className="truncate">{tGuardians("family-title")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={
                  matchRoute({
                    params: { slug },
                    to: "/school/$slug/grades",
                  }) !== false
                }
                render={<Link params={{ slug }} to="/school/$slug/grades" />}
                tooltip={tGrades("own-title")}
              >
                <HugeIcons icon={ChartBarLineIcon} />
                <span className="truncate">{tGrades("own-title")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={
                  matchRoute({
                    params: { slug },
                    to: "/school/$slug/cards",
                  }) !== false
                }
                render={<Link params={{ slug }} to="/school/$slug/cards" />}
                tooltip={tReports("own-title")}
              >
                <HugeIcons icon={Certificate01Icon} />
                <span className="truncate">{tReports("own-title")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </>
        ) : null}
        {canOpenInsight ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={
                matchRoute({
                  params: { slug },
                  to: "/school/$slug/insight",
                }) !== false
              }
              render={<Link params={{ slug }} to="/school/$slug/insight" />}
              tooltip={tInsight("title")}
            >
              <HugeIcons icon={Analytics01Icon} />
              <span className="truncate">{tInsight("title")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : null}
        {canOpenExams || home.canWatch ? (
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
      {Option.isSome(settings) ? (
        <TenantSidebarGroup label={tSettings("manage-group")}>
          <TenantSetupItem />
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<TargetLink target={settings.value} />}
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
