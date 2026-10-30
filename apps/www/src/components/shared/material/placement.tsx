import { Effect, Fiber, Option } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useStore } from "zustand";
import { BreadcrumbHeaderSegment } from "@/components/shared/breadcrumb/header";
import { PaginationContent } from "@/components/shared/content/pagination";
import { SidebarRightHeader } from "@/components/shared/outline/panel";
import {
  type MaterialNavigationPage,
  type MaterialPlacement,
  readMaterialNavigation,
} from "@/lib/content/material/navigation";
import {
  createPlacementStore,
  keepPlacement,
  type PlacementStore,
  readLessonPlacementOnce,
} from "@/lib/content/material/placement";
import {
  holdPlacementPaint,
  settlePlacementPaint,
} from "@/lib/content/material/prepaint";
import { publicPathTarget } from "@/lib/routing/target";

/** One lesson page's navigation model and the store of its verified placement. */
const PlacementContext = createContext<{
  readonly page: MaterialNavigationPage;
  readonly store: PlacementStore;
} | null>(null);

/**
 * Holds the curriculum placement that the `ctx` hint of the reader's address
 * names. The lesson's loader reads it in the browser before a client navigation
 * commits, so the first render is the final one. The router keys a lesson's
 * match by its path alone, because the static page must hydrate under any hint,
 * so the loader's placement counts only when it was read for this address's
 * hint. Otherwise, as after a hard load or when the router reuses a lesson's
 * match, the path stays hidden in its row from before the first paint (the
 * root's prepaint script on a hard load, this provider's layout effect after a
 * navigation) and shows once the placement of this hint is read. The loader
 * and the provider share one read per lesson and hint. The context value never
 * changes, so the streamed lesson keeps its HTML.
 */
export function MaterialPlacementProvider({
  children,
  hint,
  locale,
  page,
  placement,
  placementHint,
}: {
  children: ReactNode;
  /** The `ctx` hint of the reader's address. */
  hint: string | undefined;
  locale: string;
  page: MaterialNavigationPage;
  placement: MaterialPlacement | null;
  /** The hint that the loader read the placement for, `""` for none, or null when it ran on the server. */
  placementHint: string | null;
}) {
  const known = placementHint === (hint ?? "");
  const [value] = useState(() => ({
    page,
    store: createPlacementStore(known ? placement : null),
  }));

  useLayoutEffect(() => {
    if (known) {
      keepPlacement(value.store, placement);
      settlePlacementPaint();
      return;
    }
    if (hint !== undefined) {
      holdPlacementPaint();
    }
    const reading = Effect.runFork(
      readLessonPlacementOnce({ ctx: hint, locale, page: value.page }).pipe(
        Effect.tap((read) =>
          Effect.sync(() => keepPlacement(value.store, read))
        ),
        Effect.ensuring(Effect.sync(settlePlacementPaint))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(reading));
    };
  }, [hint, known, locale, placement, value]);

  // A lesson left before its placement arrived never keeps the next page's path hidden.
  useEffect(() => settlePlacementPaint, []);

  return <PlacementContext value={value}>{children}</PlacementContext>;
}

/** The lesson's navigation under the placement the browser has verified so far. */
function useMaterialNavigation() {
  const value = use(PlacementContext);
  if (!value) {
    throw new Error(
      "useMaterialNavigation must be used within a MaterialPlacementProvider"
    );
  }
  const placement = useStore(value.store, (state) => state.placement);
  return {
    navigation: readMaterialNavigation(value.page, Option.getOrNull(placement)),
    page: value.page,
  };
}

/** Names the lesson, or links back to the curriculum card it was opened from. */
export function MaterialBreadcrumb({ title }: { title: string }) {
  const { navigation } = useMaterialNavigation();
  const item = Option.match(Option.fromNullishOr(navigation.link), {
    onNone: () => ({ label: title }),
    onSome: (link) =>
      Option.match(publicPathTarget(link.publicPath), {
        onNone: () => ({ label: title }),
        onSome: (target) => ({
          label: link.label,
          target: { ...target, hash: link.hash },
        }),
      }),
  });
  return <BreadcrumbHeaderSegment item={item} />;
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
