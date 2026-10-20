"use client";

import { useHotkeys } from "@mantine/hooks";
import { lazyComponent } from "@repo/design-system/lib/lazy";
import { loadSearchCommandModule } from "@/components/search/command/module";
import { ArticleNavigationContext } from "@/components/search/navigation";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";
import { useSearch } from "@/lib/search/context";

const LazySearchCommand = lazyComponent(
  () => loadSearchCommandModule().then((module) => module.SearchCommand),
  {
    loading: () => null,
    ssr: false,
  }
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
      <LazySearchCommand />
    </ArticleNavigationContext>
  );
}
