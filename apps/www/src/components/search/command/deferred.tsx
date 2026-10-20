"use client";

import { useHotkeys } from "@mantine/hooks";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ConvexIntentIsland } from "@/components/providers/island";
import { loadSearchCommandModule } from "@/components/search/command/module";
import { ArticleNavigationContext } from "@/components/search/navigation";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import { useSearch } from "@/lib/search/context";

const LazySearchCommand = lazy(() =>
  loadSearchCommandModule().then((module) => ({
    default: module.SearchCommand,
  }))
);

/** Registers lightweight shortcuts and mounts search after first activation. */
export function DeferredSearchCommand({
  articleNavigation,
}: {
  articleNavigation: readonly ArticleNavigationItem[];
}) {
  const activated = useSearch((state) => state.activated);
  const setOpen = useSearch((state) => state.setOpen);

  useHotkeys([
    ["/", () => setOpen(true)],
    ["mod+K", () => setOpen(true)],
  ]);

  if (!activated) {
    return null;
  }

  return (
    <ArticleNavigationContext value={articleNavigation}>
      <ConvexIntentIsland>
        <Suspense fallback={null}>
          <ClientOnly fallback={null}>
            <LazySearchCommand />
          </ClientOnly>
        </Suspense>
      </ConvexIntentIsland>
    </ArticleNavigationContext>
  );
}
