import type { Bounds } from "@repo/design-system/lib/toy/flight";
import { Option } from "effect";

/** The attribute `add` puts on a toy, so that a press can find the toy it landed on. */
export const TOY_ATTRIBUTE = "data-toy";

const TOY_SELECTOR = `[${TOY_ATTRIBUTE}]`;

/** The toy a press landed on: the nearest marked element around its target, inside the root. */
export function toyAt(root: HTMLElement, target: EventTarget | null) {
  const found = target instanceof Element ? target.closest(TOY_SELECTOR) : null;
  return found instanceof HTMLElement && root.contains(found)
    ? Option.some(found)
    : Option.none();
}

/**
 * Swallows the next click on a toy inside `root`, and only that one: a drag
 * must not also count as a click on the toy. A click elsewhere passes. Returns
 * what ends the wait, for a click that never comes.
 */
export function swallowClick(root: HTMLElement) {
  const swallow = new AbortController();
  root.addEventListener(
    "click",
    (event) => {
      if (Option.isSome(toyAt(root, event.target))) {
        event.preventDefault();
        event.stopPropagation();
        swallow.abort();
      }
    },
    { capture: true, signal: swallow.signal }
  );
  return swallow;
}

/**
 * The walls of a toy: its positioned parent, as offsets from the place the toy
 * lies at. A toy without a parent, because it is hidden or out of the page,
 * has none.
 */
export function boundsOf(el: HTMLElement): Option.Option<Bounds> {
  const parent = el.offsetParent;
  return parent === null
    ? Option.none()
    : Option.some({
        maxX: parent.clientWidth - el.offsetLeft - el.offsetWidth,
        maxY: parent.clientHeight - el.offsetTop - el.offsetHeight,
        minX: -el.offsetLeft,
        minY: -el.offsetTop,
      });
}
