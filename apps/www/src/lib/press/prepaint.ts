import {
  PRESS_ATTRIBUTE,
  PRESSED_ATTRIBUTE,
} from "@repo/design-system/hooks/use-press";

/**
 * Keeps a press that lands before React takes the page over. A static page
 * starts its scripts only after it paints, and a slow phone hydrates it seconds
 * later, so a press in between reaches no handler. From the head of the page,
 * the script listens in the capture phase and marks the nearest pressed control
 * that carries `data-press` with `data-pressed`: the control shows its pressed
 * look, and `useEarlyPress` replays the press once React mounts the control.
 */
export const EARLY_PRESS_SCRIPT = `(function () {
  document.addEventListener("click", function (event) {
    var control = event.target instanceof Element ? event.target.closest("[${PRESS_ATTRIBUTE}]") : null;
    if (control) {
      control.setAttribute("${PRESSED_ATTRIBUTE}", "");
    }
  }, true);
})();`;
