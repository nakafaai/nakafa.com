import { QueryResult } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import { Link } from "@repo/internationalization/src/link";
import { useMatchRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { ClassesPreloadContext } from "@/components/tenant/classes/preload";
import type { TenantValue } from "@/components/tenant/context";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";

/**
 * The Classes group of the school sidebar: one entry per class the viewer teaches or
 * attends in the school's active periods, in the order the server gives. The group
 * draws nothing while the classes load, and nothing for a viewer with no class. It
 * ends the sidebar, so the groups above it, Settings included, never move when its
 * entries arrive. A failed read keeps the group's label, with its own sentence and
 * Try again.
 */
export function TenantClassesGroup() {
  const { slug } = useTenant();
  const t = useTranslations("School");

  return (
    <ReadBoundary
      fallback={(failure) => (
        <TenantSidebarGroup label={t("classes")}>{failure}</TenantSidebarGroup>
      )}
      read={{ args: { slug }, ref: classroom.classes.mine }}
    >
      <TenantClassesRows />
    </ReadBoundary>
  );
}

/** The classes of the viewer as sidebar entries, or nothing while they load or for a viewer with none. */
function TenantClassesRows() {
  const { slug } = useTenant();
  const classes = useClassesQuery(slug);
  const t = useTranslations("School");

  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  const rows = QueryResult.isSuccess(classes) ? classes.value : [];

  if (!Arr.isReadonlyArrayNonEmpty(rows)) {
    return null;
  }

  return (
    <TenantSidebarGroup label={t("classes")}>
      {Arr.map(rows, (klass) => (
        <TenantClassItem key={klass.id} name={klass.name} slug={klass.slug} />
      ))}
    </TenantSidebarGroup>
  );
}

/**
 * Reads the viewer's classes in the school's active periods once Convex has settled
 * the session, so the query never runs before the viewer is known.
 */
function useClassesQuery(slug: TenantValue["slug"]) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const classes = use(ClassesPreloadContext);
  return usePreloadedQueryResult(
    classroom.classes.mine,
    isSettled ? { slug } : "skip",
    classes
  );
}

/**
 * One class of the school sidebar, linking to the class page on the school host. Its
 * entry is the current page on the class page and on its tabs.
 */
function TenantClassItem({ name, slug }: { name: string; slug: string }) {
  const { slug: schoolSlug } = useTenant();
  const matchRoute = useMatchRoute();
  const params = { classSlug: slug, slug: schoolSlug };
  const isActive =
    matchRoute({
      fuzzy: true,
      params,
      to: "/school/$slug/classes/$classSlug",
    }) !== false;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={<Link params={params} to="/school/$slug/classes/$classSlug" />}
      >
        {name}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
