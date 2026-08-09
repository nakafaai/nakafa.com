"use client";

import { useHotkeys } from "@mantine/hooks";
import { Data, Effect } from "effect";
import dynamic from "next/dynamic";

import { useSearch } from "@/lib/context/use-search";

/** Expected failure while warming the deferred command-search bundle. */
class SearchCommandPreloadError extends Data.TaggedError(
  "SearchCommandPreloadError"
)<{
  cause: unknown;
  message: string;
}> {}

/** Loads command search only after a learner signals intent. */
function loadSearchCommandModule() {
  return import("@/components/shared/search-command");
}

const LazySearchCommand = dynamic(
  () => loadSearchCommandModule().then((module) => module.SearchCommand),
  {
    loading: () => null,
    ssr: false,
  }
);

/** Warms command search without leaking a failed preload to the UI. */
export const preloadSearchCommand = Effect.fn("www.search.preloadCommand")(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new SearchCommandPreloadError({
        cause,
        message: "Failed to preload command search.",
      }),
    try: loadSearchCommandModule,
  }).pipe(Effect.ignore)
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
