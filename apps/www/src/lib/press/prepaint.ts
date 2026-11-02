import {
  PRESS_ATTRIBUTE,
  PRESSED_ATTRIBUTE,
} from "@repo/design-system/hooks/use-press";

/** Set on the document while a pointer is down, from before the page's own listeners exist. */
export const POINTER_DOWN_ATTRIBUTE = "data-pointer-down";

/**
 * Keeps a press that lands before React takes the page over. A static page
 * starts its scripts only after it paints, and a slow phone hydrates it seconds
 * later, so a press in between reaches no handler. From the head of the page,
 * the script listens in the capture phase and marks the nearest pressed control
 * that carries `data-press` with `data-pressed`: the control shows its pressed
 * look, and `useEarlyPress` replays the press once React mounts the control. It
 * also marks the document while a pointer is down, so a press that is still held
 * when the page starts keeps its islands from swapping under it (`usePointerState`).
 */
export const EARLY_PRESS_SCRIPT = `(function () {
  document.addEventListener("click", function (event) {
    var control = event.target instanceof Element ? event.target.closest("[${PRESS_ATTRIBUTE}]") : null;
    if (control) {
      control.setAttribute("${PRESSED_ATTRIBUTE}", "");
    }
  }, true);
  var root = document.documentElement;
  window.addEventListener("pointerdown", function () {
    root.setAttribute("${POINTER_DOWN_ATTRIBUTE}", "");
  }, true);
  ["pointerup", "pointercancel"].forEach(function (name) {
    window.addEventListener(name, function () {
      root.removeAttribute("${POINTER_DOWN_ATTRIBUTE}");
    }, true);
  });
})();`;
