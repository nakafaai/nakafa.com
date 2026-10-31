import { Array as Arr, Effect, Schema } from "effect";

/**
 * What a tab from before a deploy reads when it calls a server function that the
 * deploy replaced (`answerStaleFunction`).
 */
export const STALE_FUNCTION_MESSAGE =
  "This server function belongs to an earlier release.";

/**
 * What a page loaded before a deploy meets when it asks for something the deploy
 * replaced: the messages that Chromium, Firefox and Safari give a dynamic import
 * whose file is gone, and the answer to a server function that is gone.
 */
const STALE_CHUNK_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  STALE_FUNCTION_MESSAGE,
] as const;

/** The tab's storage could not be read or written, so the page does not reload. */
class ReloadMarkUnavailable extends Schema.TaggedError<ReloadMarkUnavailable>()(
  "ReloadMarkUnavailable",
  { cause: Schema.Unknown }
) {}

/** Whether an error is a dynamic import of a chunk, or a server function, that is gone. */
export function isStaleChunkError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    Arr.some(STALE_CHUNK_MESSAGES, (message) =>
      error.message.startsWith(message)
    )
  );
}

/** The start of the storage key that marks the reload of one address. */
const RELOAD_MARK = "nakafa:stale-chunk:";

/** The storage key that marks the reload of one address. */
function markOf(address: string) {
  return `${RELOAD_MARK}${address}`;
}

/**
 * Reloads a tab that outlived a deploy, from the head, before any script can
 * fail. A press that loads a module on intent reaches no error boundary, so
 * `useRouteFailure` never sees it. The build's preload helper reports every
 * failed import here, and the script shares that hook's mark, so one address
 * reloads once between them and a chunk that is really gone reaches its error.
 * It holds back every failure while the page goes, so none of them draws an error
 * for a moment, and a tab without storage never reloads.
 */
export const STALE_CHUNK_SCRIPT = `(function () {
  var reloading = false;
  window.addEventListener("vite:preloadError", function (event) {
    if (!reloading) {
      var mark = "${RELOAD_MARK}" + location.pathname;
      try {
        if (sessionStorage.getItem(mark) !== null) {
          return;
        }
        sessionStorage.setItem(mark, "1");
      } catch (error) {
        return;
      }
      reloading = true;
      location.reload();
    }
    event.preventDefault();
  });
})();`;

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

/**
 * Runs a server function call and answers one that a deploy replaced as a missing
 * chunk is answered: the page reloads once at its address and the call waits for
 * it, so no caller draws an error meanwhile. Every other failure, and a function
 * still missing after the reload, reaches the caller unchanged.
 */
export function recoverStaleFunction<A>(
  call: () => Promise<A>,
  page: {
    readonly address: string;
    readonly reload: () => void;
    readonly storage: Pick<Storage, "getItem" | "setItem">;
  }
) {
  return Effect.tryPromise({ catch: (cause) => cause, try: call }).pipe(
    Effect.catchIf(isStaleChunkError, (cause) =>
      reloadForStaleChunk(page.address, page.storage, page.reload).pipe(
        Effect.flatMap((reloads) =>
          reloads ? Effect.never : Effect.fail(cause)
        )
      )
    )
  );
}
