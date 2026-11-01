/** The attribute of each path a lesson's HTML holds: the `ctx` hint it answers, empty for its own. */
export const PLACEMENT_PATH_ATTRIBUTE = "data-placement-path";

/** The id of the style that shows the path of the address's hint. */
const PLACEMENT_STYLE_ID = "placement-paint";

/** Accepts a `ctx` hint of the shape `program~node`, as the links write it. */
const HINT_PATTERN = "^[^~]+~[^~]+$";

/**
 * Shows the path of the address's curriculum hint before the first paint. A lesson
 * is static, so its HTML holds its own path and one hidden path for each curriculum
 * place that shows it. This script is the only
 * reader of the address before the page's scripts arrive, and it needs no network,
 * so the path stands at the first paint on any phone, in a row of the same height.
 */
export const PLACEMENT_PREPAINT_SCRIPT = `(function () {
  try {
    var hint = new URLSearchParams(window.location.search).get("ctx");
    if (hint && new RegExp("${HINT_PATTERN}").test(hint)) {
      var style = document.createElement("style");
      style.id = "${PLACEMENT_STYLE_ID}";
      style.textContent = '[${PLACEMENT_PATH_ATTRIBUTE}=""]{display:none!important}[${PLACEMENT_PATH_ATTRIBUTE}="' + CSS.escape(hint) + '"]{display:contents!important}';
      document.head.appendChild(style);
    }
  } catch (error) {}
})();`;

/**
 * Shows the path of a hint that the lesson holds, as the script does for a hard
 * load, or the lesson's own path with no hint. A hint the lesson does not hold, which
 * only a forged address carries, comes here as none, so its row shows the lesson.
 */
export function paintPlacement(hint: string | null) {
  document.querySelector(`#${PLACEMENT_STYLE_ID}`)?.remove();
  if (hint === null) {
    return;
  }
  const style = document.createElement("style");
  style.id = PLACEMENT_STYLE_ID;
  style.textContent = `[${PLACEMENT_PATH_ATTRIBUTE}=""]{display:none!important}[${PLACEMENT_PATH_ATTRIBUTE}="${CSS.escape(hint)}"]{display:contents!important}`;
  document.head.append(style);
}
