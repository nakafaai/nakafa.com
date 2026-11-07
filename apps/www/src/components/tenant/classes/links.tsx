import type { GenericId } from "@confect/core";
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/design-system/components/ui/sidebar-submenu";
import { useMatchRoute } from "@tanstack/react-router";
import { Option } from "effect";
import { useTranslations } from "use-intl";
import { useTenant } from "@/components/tenant/context";
import { showsStudentHome } from "@/components/tenant/home/access";
import { Link } from "@/lib/routing/link";

/**
 * The open class's places under its sidebar entry, so a class is the hub of a school day: its
 * forum, library and tasks, then the exams, the report cards and the graduation of its cohort, and
 * the insight, each for a viewer whose role opens that page. A student finds their own exams and
 * report cards there. Each page still decides for itself what the viewer reads.
 */
export function TenantClassLinks({
  classSlug,
  cohortId,
}: {
  classSlug: string;
  cohortId: GenericId.GenericId<"tenantCohorts">;
}) {
  const tenant = useTenant();
  const { canOpenExams, canOpenGraduation, canOpenInsight, canOpenReports } =
    tenant;
  const slug = tenant.slug;
  const matchRoute = useMatchRoute();
  const t = useTranslations("Classroom");
  const tExams = useTranslations("Exams");
  const tGraduation = useTranslations("SchoolGraduation");
  const tInsight = useTranslations("SchoolInsight");
  const tReports = useTranslations("SchoolReports");
  const params = { classSlug, slug };
  const cohort = { cohortId, slug };
  const isStudent = Option.contains(tenant.role, "student");

  return (
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={
            matchRoute({
              fuzzy: true,
              params,
              to: "/school/$slug/classes/$classSlug/forum",
            }) !== false
          }
          render={
            <Link params={params} to="/school/$slug/classes/$classSlug/forum" />
          }
        >
          <span>{t("tabs-forum")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={
            matchRoute({
              fuzzy: true,
              params,
              to: "/school/$slug/classes/$classSlug/library",
            }) !== false
          }
          render={
            <Link
              params={params}
              to="/school/$slug/classes/$classSlug/library"
            />
          }
        >
          <span>{t("tabs-library")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={
            matchRoute({
              fuzzy: true,
              params,
              to: "/school/$slug/classes/$classSlug/tasks",
            }) !== false
          }
          render={
            <Link params={params} to="/school/$slug/classes/$classSlug/tasks" />
          }
        >
          <span>{t("tabs-tasks")}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {showsStudentHome(tenant, tenant.home) ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={<Link params={{ slug }} to="/school/$slug/sittings" />}
          >
            <span>{tExams("title")}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {canOpenExams || tenant.home.canWatch ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={<Link params={{ slug }} to="/school/$slug/exams" />}
          >
            <span>{tExams("title")}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {isStudent ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={<Link params={{ slug }} to="/school/$slug/cards" />}
          >
            <span>{tReports("own-title")}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {canOpenReports ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={
              <Link params={cohort} to="/school/$slug/reports/$cohortId" />
            }
          >
            <span>{tReports("title")}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {canOpenInsight ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={<Link params={{ slug }} to="/school/$slug/insight" />}
          >
            <span>{tInsight("title")}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {canOpenGraduation ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={
              <Link params={cohort} to="/school/$slug/graduation/$cohortId" />
            }
          >
            <span>{tGraduation("title")}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
    </SidebarMenuSub>
  );
}
