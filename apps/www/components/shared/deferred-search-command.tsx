"use client";

import { useHotkeys } from "@mantine/hooks";
import dynamic from "next/dynamic";

import { loadSearchCommandModule } from "@/components/shared/search-command-module";
import { useSearch } from "@/lib/context/use-search";

const LazySearchCommand = dynamic(
  () => loadSearchCommandModule().then((module) => module.SearchCommand),
  {
    loading: () => null,
    ssr: false,
  }
);

/** Registers lightweight shortcuts and mounts search after first activation. */
export function DeferredSearchCommand() {
  const activated = useSearch((state) => state.activated);
  const setOpen = useSearch((state) => state.setOpen);

  useHotkeys([
    ["/", () => setOpen(true)],
    ["mod+K", () => setOpen(true)],
  ]);

  if (!activated) {
    return null;
  }

  return <LazySearchCommand />;
}
