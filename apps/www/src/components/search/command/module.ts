import { Data, Effect } from "effect";

/** Expected failure while warming the deferred command-search bundle. */
class SearchCommandPreloadError extends Data.TaggedError(
  "SearchCommandPreloadError"
)<{
  cause: unknown;
  message: string;
}> {}

/** Loads command search when the learner opens it. */
export function loadSearchCommandModule() {
  return import("@/components/search/command");
}

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
