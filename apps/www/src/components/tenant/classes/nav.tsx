import type { Ref } from "@confect/core";
import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { UserMultiple02Icon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar-menu";
import type { Mascot } from "@repo/mascot/code";
import { useMatchRoute } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { markOf, withMarks } from "@/components/tenant/classes/marks";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { Link } from "@/lib/routing/link";

/** How many of a unit's classes the sidebar loads at a time, as the reader scrolls to them. */
const PAGE_SIZE = 25;

/**
 * The Classes group of the school sidebar: one entry per class the viewer teaches or
 * attends in the school's active periods, in the order the server gives, then every
 * other class of the school for a viewer who may read them, one group per unit. The
 * group draws nothing while the classes load, and nothing for a viewer with no class.
 * It ends the sidebar, so the groups above it, Settings included, never move when its
 * entries arrive, and a school of hundreds of classes loads them as the sidebar scrolls.
 * A failed read keeps the group's label, with its own sentence and Try again.
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

/** The classes of the viewer as sidebar entries, then the school's own for a viewer who may list them. */
function TenantClassesRows() {
  const classes = useMyClasses();
  const { reach } = useTenant();
  const t = useTranslations("School");

  if (QueryResult.isFailure(classes)) {
    throw classes.error;
  }
  const rows = QueryResult.isSuccess(classes) ? classes.value : [];

  return (
    <>
      {Arr.isReadonlyArrayNonEmpty(rows) ? (
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
      ) : null}
      {Arr.contains(reach, "class.list") ? <TenantSchoolClasses /> : null}
    </>
  );
}

/** One group of classes per active unit of the school. */
function TenantSchoolClasses() {
  const viewer = useViewerQuery();

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }

  return Arr.map(
    Arr.filter(viewer.value.units, (unit) => unit.status === "active"),
    (unit) => <TenantUnitClasses key={unit.id} unit={unit} />
  );
}

/**
 * The active classes of a unit's active period that the viewer does not already find under their
 * own, a page at a time. A unit the viewer does not lead refuses the list, so it draws nothing, and
 * so does a unit with no active period.
 */
function TenantUnitClasses({
  unit,
}: {
  unit: Ref.Returns<typeof tenancy.viewer.get>["units"][number];
}) {
  const { slug } = useTenant();
  const mine = useMyClasses();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const period = useQuery(
    tenancy.cohorts.activePeriod,
    isSettled ? { slug, unitId: unit.id } : "skip"
  );
  const periodId = QueryResult.isSuccess(period) ? period.value : null;
  const pagination = usePaginatedQuery(
    classroom.classes.list,
    periodId === null ? "skip" : { periodId, slug },
    { initialNumItems: PAGE_SIZE }
  );

  if (QueryResult.isFailure(period)) {
    if (isDenied(period.error)) {
      return null;
    }
    throw period.error;
  }
  if (PaginatedQueryResult.isFailure(pagination)) {
    if (isDenied(pagination.error)) {
      return null;
    }
    throw pagination.error;
  }
  const own = QueryResult.isSuccess(mine)
    ? Arr.map(mine.value, (klass) => klass.id)
    : [];
  const rows = Arr.filter(
    pagination.results,
    (klass) => klass.status === "active" && !Arr.contains(own, klass.id)
  );

  if (Arr.isReadonlyArrayEmpty(rows)) {
    return null;
  }

  return (
    <TenantSidebarGroup icon={UserMultiple02Icon} label={unit.name}>
      {Arr.map(rows, (klass) => (
        <TenantClassItem
          key={klass.id}
          mascot={markOf(klass.id)}
          name={klass.name}
          slug={klass.slug}
        />
      ))}
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </TenantSidebarGroup>
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
