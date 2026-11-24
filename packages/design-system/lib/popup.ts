import { cva } from "class-variance-authority";
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
 * corners, clear of the home indicator, and never taller than the screen less a band of the page above it. The screen
 * is the part the keyboard leaves (`--visual-viewport-height`, which UI SDK sets on the sheet's host), so a sheet
 * with a field keeps the field in view while the reader types.
 *
 * A body that scrolls inside a sheet hands a swipe on past its top to the sheet, so a swipe down closes the sheet from
 * anywhere, as an iPhone sheet's does. A sheet that clips its corners clips with `overflow: clip`, never hidden, which
 * would make it a scroll container that UI SDK's `overscroll-behavior: contain` keeps every swipe in (`DrawerContent`).
 *
 * A sheet that another sheet rises over, such as a menu's sheet under its submenu's, stays still: the sheet in front
 * rises over it and the backdrop dims it. Shrinking it would restyle and repaint every part of it on each frame of the
 * rise, which stutters on a phone, and tells the reader nothing the dimmed backdrop does not. A drawer stays still the
 * same way (`DrawerContent`).
 */
export const sheetSurface = cva(
  "data-[presentation=sheet]:pb-[max(--spacing(2),env(safe-area-inset-bottom))] data-[presentation=sheet]:max-h-[calc(var(--visual-viewport-height,100dvh)-3rem)] data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-none data-[presentation=sheet]:rounded-t-3xl data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:border-x-0 data-[presentation=sheet]:border-b-0 data-[presentation=sheet]:[&_[data-slot=scroll-area-viewport]]:overscroll-auto"
);
