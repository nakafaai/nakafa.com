/** Says that this tab has already reloaded for a missing script. */
const STALE_CHUNK_KEY = "nakafa-stale-chunk";

/**
 * Reloads a tab that outlived a deploy, once. A deploy removes the last release's
 * scripts, so a tab still open on it gets a 404 for the next script it asks for,
 * and the press that asked for it fails. The router reloads for a route's own
 * chunk, but a lazy component and a module that loads on intent have no such
 * path. The build's preload helper reports each of them here, and a fresh document
 * names the new release's scripts. Session storage holds the one reload across
 * it, so a script that is really gone reaches its error boundary instead of
 * looping, and a tab without storage never reloads. It sits in the head, because
 * the failure it answers can be in any script.
 */
export const STALE_CHUNK_SCRIPT = `(function () {
  var reloading = false;
  window.addEventListener("vite:preloadError", function (event) {
    if (!reloading) {
      try {
        if (sessionStorage.getItem("${STALE_CHUNK_KEY}")) {
          return;
        }
        sessionStorage.setItem("${STALE_CHUNK_KEY}", "1");
      } catch (error) {
        return;
      }
      reloading = true;
      location.reload();
    }
    event.preventDefault();
  });
})();`;
