import { QueryResult } from "@confect/react";
import { CheckListIcon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { useMatchRoute } from "@tanstack/react-router";
import { useTranslations } from "use-intl";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { Link } from "@/lib/routing/link";

/**
 * Whether the school's setup is still open. It waits for the viewer, so a finished school
 * never shows the entry for a moment.
 */
function useSetupOpen() {
  const viewer = useViewerQuery();
  return QueryResult.isSuccess(viewer) && !viewer.value.tenant.setupDone;
}

/** The entry of the school's setup, which stays until the Owner or an Admin finishes it. */
export function TenantSetupItem() {
  const { slug } = useTenant();
  const matchRoute = useMatchRoute();
  const t = useTranslations("SchoolSettings");

  if (!useSetupOpen()) {
    return null;
  }
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={
          matchRoute({ params: { slug }, to: "/school/$slug/setup" }) !== false
        }
        render={<Link params={{ slug }} to="/school/$slug/setup" />}
        tooltip={t("setup-title")}
      >
        <HugeIcons icon={CheckListIcon} />
        <span className="truncate">{t("setup-title")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/** The setup entry as a sidebar group of its own, which leaves no gap once setup is finished. */
export function TenantSetupGroup() {
  if (!useSetupOpen()) {
    return null;
  }
  return (
    <TenantSidebarGroup>
      <TenantSetupItem />
    </TenantSidebarGroup>
  );
}
