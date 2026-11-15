import {
  GOING_ATTRIBUTE,
  GOING_LEAVE,
  GOING_RELOAD,
} from "@repo/design-system/lib/lazy";
import { Duration } from "effect";
import { RELOAD_HOLD, RELOAD_MARK } from "@/lib/chunks/stale";

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
 * navigation, so a tab that is leaving never reloads. A leave of the page's own,
 * a link, a form or a script that sets the address, says so first through the
 * Navigation API's `navigate`: Safari fails the imports of a page that a script
 * sends to another address before `beforeunload`, so a press that leaves for
 * Google's consent screen would otherwise reload the page it leaves. A move
 * within the document and a download keep the page. A leave from the browser's
 * own controls says so only through `beforeunload`, which costs a page Firefox's
 * back-forward cache. A prompt of the page can keep it after either signal, so
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
  function leave() {
    if (root.getAttribute("${GOING_ATTRIBUTE}") === null) {
      root.setAttribute("${GOING_ATTRIBUTE}", "${GOING_LEAVE}");
    }
  }
  window.addEventListener("beforeunload", leave);
  if (window.navigation) {
    window.navigation.addEventListener("navigate", function (event) {
      if (event.destination.sameDocument || event.downloadRequest !== null) {
        return;
      }
      leave();
    });
  }
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
