import type { Ref } from "@confect/core";
import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
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
import { Array as Arr, MutableHashMap, Option } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { markOf, withMarks } from "@/components/tenant/classes/marks";
import { useMyClasses } from "@/components/tenant/classes/mine";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { TenantSidebarGroup } from "@/components/tenant/group";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { type PreloadedPage, readFirstPage } from "@/lib/data/paginated";
import { Link } from "@/lib/routing/link";

/** How many of a unit's classes the sidebar loads at a time, as the reader scrolls to them. */
const PAGE_SIZE = 25;

/**
 * The classes the school sidebar last drew for each period it lists. The sidebar draws its groups twice, beside the
 * page on a wide screen and in a sheet on a phone, and the sheet mounts its copy as it opens, when a new paginated
 * read of a unit's classes holds no rows yet. The copy beside the page stays mounted, hidden on a phone, and keeps
 * the classes it drew here, so the sheet's copy draws them in its first frame while its own read arrives with the
 * same rows: the phone's sidebar opens whole, with no group added under the reader's eyes.
 */
const DrawnClassesContext = createContext<MutableHashMap.MutableHashMap<
  string,
  PreloadedPage<PaginatedQueryItem<typeof classroom.classes.list>>
> | null>(null);

/** Holds the classes the school sidebar drew, around both of its copies. */
export function DrawnClasses({ children }: { children: ReactNode }) {
  const [drawn] = useState(() =>
    MutableHashMap.empty<
      string,
      PreloadedPage<PaginatedQueryItem<typeof classroom.classes.list>>
    >()
  );
  return <DrawnClassesContext value={drawn}>{children}</DrawnClassesContext>;
}

/** Reads the classes the sidebar drew. It throws outside the school's frame, which always provides them. */
function useDrawnClasses() {
  const drawn = use(DrawnClassesContext);
  if (drawn === null) {
    throw new Error("useDrawnClasses must be used within DrawnClasses");
  }
  return drawn;
}

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
        <TenantSidebarGroup label={t("classes")}>{failure}</TenantSidebarGroup>
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
        <TenantSidebarGroup label={t("classes")}>
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
 * The active period of a unit and its classes, a page at a time. Until the read has its first page, the classes the
 * sidebar last drew for the period stand in, and each page the read holds is kept for the copy that mounts next.
 */
function useUnitClasses(
  unitId: Ref.Returns<typeof tenancy.viewer.get>["units"][number]["id"]
) {
  const { slug } = useTenant();
  const drawn = useDrawnClasses();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const period = useQuery(
    tenancy.cohorts.activePeriod,
    isSettled ? { slug, unitId } : "skip"
  );
  const periodId = QueryResult.isSuccess(period) ? period.value : null;
  const live = usePaginatedQuery(
    classroom.classes.list,
    periodId === null ? "skip" : { periodId, slug },
    { initialNumItems: PAGE_SIZE }
  );

  useEffect(() => {
    if (
      periodId === null ||
      PaginatedQueryResult.isLoadingFirstPage(live) ||
      PaginatedQueryResult.isFailure(live)
    ) {
      return;
    }
    MutableHashMap.set(drawn, periodId, {
      isDone: PaginatedQueryResult.isExhausted(live),
      page: live.results,
    });
  }, [drawn, live, periodId]);

  return {
    pagination: readFirstPage(
      live,
      periodId === null ? Option.none() : MutableHashMap.get(drawn, periodId)
    ),
    period,
  };
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
  const mine = useMyClasses();
  const { pagination, period } = useUnitClasses(unit.id);

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
    <TenantSidebarGroup label={unit.name}>
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
 * One class of the school sidebar, linking to the class home on the school host, marked
 * with its animal as the school switcher marks a school. A press opens the class; its places
 * are the page's own tabs, so the entry unfolds nothing. Its entry is the current page on the
 * class page and on its tabs.
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
