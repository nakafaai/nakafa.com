import { QueryResult } from "@confect/react";
import { UserMultiple02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import type { Mascot } from "@repo/mascot/code";
import { useMatchRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { use } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { withMarks } from "@/components/tenant/classes/marks";
import { ClassesPreloadContext } from "@/components/tenant/classes/preload";
import type { TenantValue } from "@/components/tenant/context";
import { useTenant } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { usePreloadedQueryResult } from "@/lib/data/preloaded";
import { Link } from "@/lib/routing/link";

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
        <TenantSidebarGroup icon={UserMultiple02Icon} label={t("classes")}>
          {failure}
        </TenantSidebarGroup>
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
    <TenantSidebarGroup icon={UserMultiple02Icon} label={t("classes")}>
      {Arr.map(withMarks(rows), (klass) => (
        <TenantClassItem
          key={klass.id}
          mascot={klass.mascot}
          name={klass.name}
          slug={klass.slug}
        />
      ))}
    </TenantSidebarGroup>
  );
}

/**
 * Reads the viewer's classes in the school's active periods once Convex has settled
 * the session, so the query never runs before the viewer is known.
 */
export function useClassesQuery(slug: TenantValue["slug"]) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const classes = use(ClassesPreloadContext);
  return usePreloadedQueryResult(
    classroom.classes.mine,
    isSettled ? { slug } : "skip",
    classes
  );
}

/**
 * One class of the school sidebar, linking to the class page on the school host, marked
 * with its animal as the school switcher marks a school. Its entry is the current page on
 * the class page and on its tabs.
 */
function TenantClassItem({
  mascot,
  name,
  slug,
}: {
  mascot: typeof Mascot.Type;
  name: string;
  slug: string;
}) {
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
        tooltip={name}
      >
        <PersonAvatar className="size-5" mascot={mascot} />
        <span className="truncate" dir="auto">
          {name}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
