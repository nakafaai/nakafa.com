import { ButtonGroupVariant } from "@repo/design-system/lib/group";
import type { ReactNode } from "react";

/** The attribute that marks the place of a popup beside its trigger, for a row that counts its own parts. */
export const POPUP_PLACE = "[data-popup-place]";

/**
 * Where a popup of the design system stands in the page: written beside its trigger (ADR 0049), in a box that takes no
 * room, so the row of its trigger lays out as if it were not there. An open popup stands in the top layer and a closed
 * one leaves the page or waits hidden, so in a row it should take no room either way. Safari still counted a sheet
 * that had stood in the top layer into the width of its trigger's row after it closed, and the row kept that width:
 * the search button of the Quran's header moved to the middle of the bar after its sheet closed once
 * (vercel-labs/ui#1022). A box with no size, out of the flow, holds nothing the row can count, whatever a browser
 * keeps of what it held.
 *
 * It also starts the popup outside any button group, so a dialog that opens from a grouped button keeps its own
 * variant (`ButtonGroupVariant`).
 */
export function PopupPlace({ children }: { children: ReactNode }) {
  return (
    <ButtonGroupVariant value={undefined}>
      <span className="absolute size-0" data-popup-place="">
        {children}
      </span>
    </ButtonGroupVariant>
  );
}
