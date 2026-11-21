import type { PointerEvent } from "react";

/** How far, in CSS pixels, a press may travel and still count as a click: UI SDK's menu and select use the same. */
const CLICK_TRAVEL = 4;

/** The parts of a trigger's `pointerdown` that `keepClickOnTrigger` reads. */
type TriggerPress = Pick<
  PointerEvent<HTMLElement>,
  | "button"
  | "clientX"
  | "clientY"
  | "currentTarget"
  | "pointerId"
  | "pointerType"
>;

/**
 * Keeps a mouse or pen click on the menu or select trigger it pressed, so the popup it opened stays open. The trigger's
 * `onPointerDown`.
 *
 * UI SDK opens the popup on `pointerdown` and, on `pointerup`, reads a press held for 200 ms and released off the
 * trigger as a hold that chose nothing, and closes the popup. It times the hold when each handler runs, not when the
 * input happened, and the open popup covers the trigger, so the release lands on an ancestor even when the pointer
 * never moved. A click on a busy main thread, or on a slow phone, closed the popup it had just opened
 * (vercel-labs/ui#1005). The trigger captures the pointer while it stays within a click's travel, so the release
 * lands on the trigger, and lets it go once the pointer travels further, so a press dragged onto an item still
 * chooses it. A touch press is captured by its target already, and UI SDK does not open on it.
 * https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture
 */
export function keepClickOnTrigger(press: TriggerPress) {
  if (press.button !== 0 || press.pointerType === "touch") {
    return;
  }
  const trigger: HTMLElement = press.currentTarget;
  const { clientX, clientY, pointerId } = press;
  const pressing = new AbortController();
  trigger.setPointerCapture(pointerId);
  trigger.addEventListener(
    "pointermove",
    (move) => {
      const travel = Math.hypot(move.clientX - clientX, move.clientY - clientY);
      if (move.pointerId !== pointerId || travel <= CLICK_TRAVEL) {
        return;
      }
      pressing.abort();
      trigger.releasePointerCapture(pointerId);
    },
    { signal: pressing.signal }
  );
  trigger.addEventListener("lostpointercapture", () => pressing.abort(), {
    signal: pressing.signal,
  });
}
