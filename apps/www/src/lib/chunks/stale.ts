import { Array as Arr, Effect, Schema } from "effect";

/**
 * The messages that Chromium, Firefox and Safari give a dynamic import whose
 * file is gone, which is what a page loaded before a deploy meets when it asks
 * for a chunk that the deploy replaced.
 */
const STALE_CHUNK_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
] as const;

/** The tab's storage could not be read or written, so the page does not reload. */
class ReloadMarkUnavailable extends Schema.TaggedError<ReloadMarkUnavailable>()(
  "ReloadMarkUnavailable",
  { cause: Schema.Unknown }
) {}

/** Whether an error is a dynamic import of a chunk that is gone. */
export function isStaleChunkError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    Arr.some(STALE_CHUNK_MESSAGES, (message) =>
      error.message.startsWith(message)
    )
  );
}

/** The storage key that marks the reload of one address. */
function markOf(address: string) {
  return `nakafa:stale-chunk:${address}`;
}

/**
 * Reloads the page once at its address for a chunk of an earlier deploy, so the
 * page loads the current deploy's chunks instead of showing an error. The tab's
 * storage marks the address first, so a chunk that is still missing after the
 * reload shows the error and never loops. The mark names the address, not the
 * chunk: a press can ask for several chunks, and the one that fails first may
 * differ after the reload, which would otherwise reload again for each of them.
 * A tab without storage never reloads. Answers whether the page reloads.
 */
export const reloadForStaleChunk = Effect.fn("www.chunks.reloadForStale")(
  function* (
    address: string,
    storage: Pick<Storage, "getItem" | "setItem">,
    reload: () => void
  ) {
    const marked = yield* Effect.try({
      try: () => storage.getItem(markOf(address)) !== null,
      catch: (cause) => new ReloadMarkUnavailable({ cause }),
    });
    if (marked) {
      return false;
    }
    yield* Effect.try({
      try: () => storage.setItem(markOf(address), "1"),
      catch: (cause) => new ReloadMarkUnavailable({ cause }),
    });
    yield* Effect.sync(reload);
    return true;
  },
  Effect.catchTag("ReloadMarkUnavailable", () => Effect.succeed(false))
);
