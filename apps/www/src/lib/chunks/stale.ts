import {
  GOING_ATTRIBUTE,
  GOING_LEAVE,
  GOING_RELOAD,
} from "@repo/design-system/lib/lazy";
import { Array as Arr, Clock, Duration, Effect, Option, Schema } from "effect";

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

/**
 * How long the reload of an address holds back another. A chunk still missing
 * once its reload has loaded the current deploy shows its error instead of
 * reloading again, and the next deploy, minutes later, reloads the tab again.
 */
const RELOAD_HOLD = Duration.minutes(1);

/** The storage key that marks the reload of one address. */
function markOf(address: string) {
  return `${RELOAD_MARK}${address}`;
}

/**
 * Reloads a tab that outlived a deploy, from the head, before any script can
 * fail. A press that loads a module on intent reaches no error boundary, so
 * `useRouteFailure` never sees it. The build's preload helper reports every
 * failed import here. The script marks the address with the time and reloads,
 * and an address reloads once within `RELOAD_HOLD` between the script and that
 * hook, so a chunk that is really gone reaches its error. The failure itself
 * goes on to its import as the browser threw it: cancelling it would hand the
 * import an empty module, which no caller can read. While the page goes, the
 * root element says so (`GOING_ATTRIBUTE`), and `readChunk` holds such a failure
 * until the page is gone. A browser without a network keeps its page: the chunk
 * is out of reach, not gone, and a reload would swap the page for the browser's
 * offline screen. Firefox and Safari also fail a page's running imports the
 * moment the tab starts to leave it, and a reload then would cancel the
 * navigation, so a tab that is leaving never reloads. `beforeunload` is the only
 * signal that comes before those failures, and it costs a page Firefox's
 * back-forward cache. A prompt of the page can keep it after `beforeunload`, so
 * the next press, or the page's return from that cache, shows that it stayed: it
 * ends the leave, and a reload that never happened gives its mark back.
 */
export const STALE_CHUNK_SCRIPT = `(function () {
  var root = document.documentElement;
  var hold = ${Duration.toMillis(RELOAD_HOLD)};
  function markOf() {
    return "${RELOAD_MARK}" + location.pathname;
  }
  function stay() {
    var going = root.getAttribute("${GOING_ATTRIBUTE}");
    if (going === null) {
      return;
    }
    root.removeAttribute("${GOING_ATTRIBUTE}");
    if (going === "${GOING_RELOAD}") {
      try {
        sessionStorage.removeItem(markOf());
      } catch (error) {}
    }
  }
  window.addEventListener("beforeunload", function () {
    if (root.getAttribute("${GOING_ATTRIBUTE}") === null) {
      root.setAttribute("${GOING_ATTRIBUTE}", "${GOING_LEAVE}");
    }
  });
  window.addEventListener("pageshow", stay);
  window.addEventListener("pointerdown", stay, true);
  window.addEventListener("keydown", stay, true);
  window.addEventListener("vite:preloadError", function () {
    if (root.getAttribute("${GOING_ATTRIBUTE}") !== null) {
      return;
    }
    if (navigator.onLine === false) {
      return;
    }
    try {
      var now = Date.now();
      var marked = sessionStorage.getItem(markOf());
      var age = now - Number(marked);
      if (marked !== null && age >= 0 && age < hold) {
        return;
      }
      sessionStorage.setItem(markOf(), String(now));
    } catch (error) {
      return;
    }
    root.setAttribute("${GOING_ATTRIBUTE}", "${GOING_RELOAD}");
    location.reload();
  });
})();`;

/**
 * Reloads the page and says so on its root element first, so `readChunk` holds the
 * failures that the reload answers, and no prompt of the page stops it for work the
 * server already has.
 */
export function reloadPage() {
  document.documentElement.setAttribute(GOING_ATTRIBUTE, GOING_RELOAD);
  window.location.reload();
}

/**
 * Reloads the page once at its address for a chunk of an earlier deploy, so the
 * page loads the current deploy's chunks instead of showing an error. The tab's
 * storage marks the address with the time first, so a chunk that is still missing
 * after the reload shows the error and never loops, and the next deploy reloads
 * the tab again once `RELOAD_HOLD` has passed. The mark names the address, not the
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
    const now = yield* Clock.currentTimeMillis;
    const marked = yield* Effect.try({
      try: () => storage.getItem(markOf(address)),
      catch: (cause) => new ReloadMarkUnavailable({ cause }),
    });
    const age = now - Number(marked);
    if (marked !== null && age >= 0 && age < Duration.toMillis(RELOAD_HOLD)) {
      return false;
    }
    yield* Effect.try({
      try: () => storage.setItem(markOf(address), String(now)),
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
        reload: reloadPage,
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
