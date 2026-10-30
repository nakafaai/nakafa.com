import { Effect, Fiber, Option } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
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
  type PlacementStore,
  startMaterialPlacement,
} from "@/lib/content/material/placement";
import { settlePlacementPaint } from "@/lib/content/material/prepaint";
import { publicPathTarget } from "@/lib/routing/target";

/** One lesson page's navigation model and the store of its verified placement. */
const PlacementContext = createContext<{
  readonly page: MaterialNavigationPage;
  readonly store: PlacementStore;
} | null>(null);

/**
 * Holds the curriculum placement that the `ctx` hint of the reader's address
 * names. A client navigation's loader reads it before the page commits, so the
 * first render is the final one. A hard load paints the static lesson, which
 * cannot see the hint: the root's prepaint script keeps the breadcrumb path
 * hidden in its row, the browser verifies the hint once the page has hydrated,
 * and the path shows only once the placement is known, so it never swaps. The
 * context value never changes, so the streamed lesson keeps its HTML.
 */
export function MaterialPlacementProvider({
  children,
  ctx,
  initial,
  locale,
  page,
}: {
  children: ReactNode;
  ctx: string | undefined;
  initial: MaterialPlacement | null;
  locale: string;
  page: MaterialNavigationPage;
}) {
  const [value] = useState(() => ({
    page,
    store: createPlacementStore(initial),
  }));

  useEffect(() => {
    if (initial !== null) {
      settlePlacementPaint();
      return;
    }
    const reading = Effect.runFork(
      startMaterialPlacement(value.store, {
        ctx,
        locale,
        page: value.page,
      }).pipe(Effect.ensuring(Effect.sync(settlePlacementPaint)))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(reading));
      settlePlacementPaint();
    };
  }, [ctx, initial, locale, value]);

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
