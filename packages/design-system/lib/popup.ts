import { cva } from "class-variance-authority";
import type { PointerEvent } from "react";
import { createContext } from "react";

/**
 * Where the popups drawn under it render, when not where they are written. A popup renders in place (ADR 0049), but
 * ProseMirror owns the DOM of an editor's document and redraws a node whose DOM takes the focus or the selection, which
 * would take a popup drawn inside the node down with it as it opens. So a node view (`EditorNodeView`) names the page's
 * body here, and every popup root of the design system renders there under it, its backdrop and the popups it opens
 * included. Elsewhere it names none (`null`).
 */
export const PopupContainer = createContext<HTMLElement | null>(null);

/**
 * How every anchored popup of the design system enters and leaves: it fades and grows from the point of its trigger,
 * and shrinks back as it closes, kept in the page until its exit ends. Where motion is reduced it only fades, and a
 * tooltip that opens at once because another just closed skips the motion. A popup that rises as a sheet on a phone
 * moves as the sheet does, by the finger and its spring, so none of this applies to it.
 */
export const popupMotion = cva(
  "not-data-[presentation=sheet]:duration-ui not-data-[presentation=sheet]:origin-(--transform-origin) not-data-[presentation=sheet]:transition-[opacity,scale] not-data-[presentation=sheet]:ease-out not-data-[presentation=sheet]:data-ending-style:opacity-0 not-data-[presentation=sheet]:data-instant:transition-none not-data-[presentation=sheet]:data-starting-style:opacity-0 not-data-[presentation=sheet]:motion-safe:data-ending-style:scale-95 not-data-[presentation=sheet]:motion-safe:data-starting-style:scale-95"
);

/**
 * The surface every popup that a phone raises as a sheet wears there: the full width of the screen, rounded on its top
 * corners, clear of the home indicator, and never taller than the screen less a band of the page above it.
 */
export const sheetSurface = cva(
  "data-[presentation=sheet]:max-h-[calc(100dvh-3rem)] data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-none data-[presentation=sheet]:rounded-t-3xl data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:border-x-0 data-[presentation=sheet]:border-b-0 data-[presentation=sheet]:pb-[max(--spacing(2),env(safe-area-inset-bottom))]"
);

/** How far, in CSS pixels, a press may travel and still count as a click: UI SDK's menu and select use the same. */
const CLICK_TRAVEL = 4;

/** The parts of a trigger's `pointerdown` that `keepClickOnTrigger` reads. */
type TriggerPress = Pick<
  PointerEvent<HTMLElement>,
  | "button"
  | "clientX"
  | "clientY"
  | "currentTarget"
  | "isTrusted"
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
 * chooses it. A touch press is captured by its target already, and UI SDK does not open on it. A press a script
 * dispatched has no pointer to capture, so it is left alone.
 * https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture
 */
export function keepClickOnTrigger(press: TriggerPress) {
  if (!press.isTrusted || press.button !== 0 || press.pointerType === "touch") {
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
