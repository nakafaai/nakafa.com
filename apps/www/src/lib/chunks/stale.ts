import { Array as Arr, Effect, Option, Schema } from "effect";

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

/** How long a tab keeps a page whose chunk still exists, so a navigation under way can finish first. */
const LEAVING_MILLIS = 5000;

/**
 * Reloads a tab that outlived a deploy, from the head, before any script can
 * fail. A press that loads a module on intent reaches no error boundary, so
 * `useRouteFailure` never sees it. The build's preload helper reports every
 * failed import here, and the script shares that hook's mark, so one address
 * reloads once between them and a chunk that is really gone reaches its error.
 * It holds back every failure while the page goes, so none of them draws an error
 * for a moment, and a tab without storage never reloads. A browser without a
 * network keeps its page: the chunk is out of reach, not gone, and a reload would
 * swap the page for the browser's offline screen.
 *
 * Firefox fails a page's running imports the moment the tab starts to leave it,
 * and a reload then cancels the navigation, so the learner stays on the old page.
 * So where the failure names its file, the file decides: a chunk a deploy removed
 * answers 404 and reloads at once, and any other answer waits, because a tab that
 * is leaving never gets there. Safari names no file, so it reloads as before.
 */
export const STALE_CHUNK_SCRIPT = `(function () {
  var reloading = false;
  window.addEventListener("vite:preloadError", function (event) {
    if (!reloading) {
      if (navigator.onLine === false) {
        return;
      }
      var mark = "${RELOAD_MARK}" + location.pathname;
      try {
        if (sessionStorage.getItem(mark) !== null) {
          return;
        }
      } catch (error) {
        return;
      }
      reloading = true;
      var reload = function () {
        try {
          sessionStorage.setItem(mark, "1");
        } catch (error) {
          return;
        }
        location.reload();
      };
      var file = /https?:\\S+/.exec(String(event.payload));
      if (file === null) {
        reload();
      } else {
        fetch(file[0], { cache: "no-store", method: "HEAD" }).then(
          function (answer) {
            setTimeout(reload, answer.status === 404 ? 0 : ${LEAVING_MILLIS});
          },
          function () {
            setTimeout(reload, ${LEAVING_MILLIS});
          }
        );
      }
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
 * A tab without storage never reloads, and neither does a browser without a
 * network, which marks nothing, so the chunk's next failure still reloads once
 * the network is back. Answers whether the page reloads.
 */
export const reloadForStaleChunk = Effect.fn("www.chunks.reloadForStale")(
  function* (
    address: string,
    storage: Pick<Storage, "getItem" | "setItem">,
    reload: () => void
  ) {
    if (navigator.onLine === false) {
      return false;
    }
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
 * The tab that a stale call reloads, or none where no tab exists. A function
 * middleware's client side also runs when a loader calls a server function during
 * server rendering. Storage is read at each use, so a browser that refuses it
 * fails inside `reloadForStaleChunk`, which never reloads for that.
 */
export function readTab() {
  return typeof window === "undefined"
    ? Option.none()
    : Option.some({
        address: window.location.pathname,
        reload: () => window.location.reload(),
        storage: {
          getItem: (key: string) => window.sessionStorage.getItem(key),
          setItem: (key: string, value: string) =>
            window.sessionStorage.setItem(key, value),
        },
      });
}

/** A server function call failed. It carries the failure, which is the caller's to read. */
class ServerFunctionFailed extends Schema.TaggedError<ServerFunctionFailed>()(
  "ServerFunctionFailed",
  { cause: Schema.Unknown }
) {}

/**
 * Runs a server function call and answers one that a deploy replaced as a missing
 * chunk is answered: the tab reloads once at its address and the call waits for
 * it, so no caller draws an error meanwhile. The tab is read only once a call has
 * failed. Every other failure, a function still missing after the reload, and a
 * failure on the server reach the caller as the call threw them, because Start
 * carries a redirect and a not-found as that same failure.
 */
export function recoverStaleFunction<A>(
  call: () => Promise<A>,
  tab: typeof readTab = readTab
) {
  return Effect.tryPromise({
    catch: (cause) => new ServerFunctionFailed({ cause }),
    try: call,
  }).pipe(
    Effect.catchIf(
      (failure) => isStaleChunkError(failure.cause),
      (failure) =>
        Option.match(tab(), {
          onNone: () => Effect.fail(failure),
          onSome: ({ address, reload, storage }) =>
            reloadForStaleChunk(address, storage, reload).pipe(
              Effect.flatMap((reloads) =>
                reloads ? Effect.never : Effect.fail(failure)
              )
            ),
        })
    ),
    Effect.catchTag("ServerFunctionFailed", ({ cause }) => Effect.die(cause))
  );
}
