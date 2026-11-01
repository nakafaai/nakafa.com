import { Array as Arr, Option } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useLayoutEffect,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { useStore } from "zustand";
import { BreadcrumbHeaderPath } from "@/components/shared/breadcrumb/header";
import { PaginationContent } from "@/components/shared/content/pagination";
import { SidebarRightHeader } from "@/components/shared/outline/panel";
import {
  type MaterialNavigationPage,
  type MaterialPlacement,
  readMaterialNavigation,
  readMaterialPath,
} from "@/lib/content/material/navigation";
import {
  createPlacementStore,
  findPlacement,
  keepPlacement,
  type PlacementStore,
  placementHint,
} from "@/lib/content/material/placement";
import {
  PLACEMENT_PATH_ATTRIBUTE,
  paintPlacement,
} from "@/lib/content/material/prepaint";
import { HOME_TARGET } from "@/lib/routing/target";

/** One lesson page's navigation, its curriculum places, and the store of the one its address names. */
const PlacementContext = createContext<{
  readonly page: MaterialNavigationPage;
  readonly placements: readonly MaterialPlacement[];
  readonly store: PlacementStore;
} | null>(null);

/**
 * Holds the curriculum place that the `ctx` hint of the reader's address names.
 * The build writes every place of the lesson into its static page, so the browser
 * reads nothing: the root's prepaint script shows the path of the hint before the
 * first paint, and once React holds the page, the lesson's links take the place
 * too. The store starts empty, as the static page renders it, and this effect runs
 * before the browser paints, so a client navigation shows its path at once. The
 * context value never changes, so the streamed lesson keeps its HTML.
 */
export function MaterialPlacementProvider({
  children,
  hint,
  page,
  placements,
}: {
  children: ReactNode;
  /** The `ctx` hint of the reader's address. */
  hint: string | undefined;
  page: MaterialNavigationPage;
  placements: readonly MaterialPlacement[];
}) {
  const [value] = useState(() => ({
    page,
    placements,
    store: createPlacementStore(),
  }));

  useLayoutEffect(() => {
    const placement = findPlacement(value.placements, hint);
    keepPlacement(value.store, placement);
    paintPlacement(Option.getOrNull(Option.map(placement, placementHint)));
    return () => paintPlacement(null);
  }, [hint, value]);

  return <PlacementContext value={value}>{children}</PlacementContext>;
}

/** Reads the provider's value and rejects a missing provider. */
function usePlacementContext() {
  const value = use(PlacementContext);
  if (!value) {
    throw new Error(
      "useMaterialNavigation must be used within a MaterialPlacementProvider"
    );
  }
  return value;
}

/** The lesson's navigation under the placement of the reader's address. */
function useMaterialNavigation() {
  const value = usePlacementContext();
  const placement = useStore(value.store, (state) => state.placement);
  return {
    navigation: readMaterialNavigation(value.page, Option.getOrNull(placement)),
    page: value.page,
  };
}

/**
 * One path of the lesson in its HTML: the place's, walking from the curriculum down
 * to its card, or with no place the lesson's own, which shows until the prepaint script
 * names another.
 */
function PlacementPath({
  placement,
  title,
}: {
  placement: MaterialPlacement | null;
  title: string;
}) {
  const t = useTranslations("Common");
  const { page } = usePlacementContext();
  const hint = placement === null ? "" : placementHint(placement);
  return (
    <div
      className={placement === null ? "contents" : "hidden"}
      {...{ [PLACEMENT_PATH_ATTRIBUTE]: hint }}
    >
      <BreadcrumbHeaderPath
        home={HOME_TARGET}
        homeLabel={t("home")}
        items={readMaterialPath(readMaterialNavigation(page, placement), title)}
        unfolds
      />
    </div>
  );
}

/**
 * The lesson's path: its own, and one for each curriculum place that shows it. All of
 * them stand in the static HTML, so a reader's `ctx` shows its path at the first
 * paint, with no read and no shift.
 */
export function MaterialBreadcrumb({ title }: { title: string }) {
  const { placements } = usePlacementContext();
  return (
    <>
      <PlacementPath placement={null} title={title} />
      {Arr.map(placements, (placement) => (
        <PlacementPath
          key={placementHint(placement)}
          placement={placement}
          title={title}
        />
      ))}
    </>
  );
}

/** The outline's link to the lesson, carrying its verified placement. */
export function MaterialHeading(heading: {
  description: string;
  title: string;
}) {
  const { navigation, page } = useMaterialNavigation();
  return (
    <SidebarRightHeader
      {...heading}
      context={navigation.currentContext}
      publicPath={page.route.publicPath}
    />
  );
}

/** The lesson's previous and next pages, carrying its verified placement. */
export function MaterialPagination() {
  const { navigation } = useMaterialNavigation();
  return <PaginationContent pagination={navigation.pagination} />;
}
