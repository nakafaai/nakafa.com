import { attachSheetGrip } from "@repo/design-system/lib/sheet";

/**
 * The bar at the top of a popup that a phone raises as a sheet, which tells the reader it drags down to close, as an
 * iPhone sheet's does. It shows only while its popup presents as a sheet, and screen readers skip it: the sheet
 * closes by its keys and its back gesture as well. It lets the sheet leave at once after a swipe, and tells the sheet it
 * was opened from how tall it stands, so that one steps back behind it in view (`attachSheetGrip`).
 */
export function SheetGrip() {
  return (
    <div
      aria-hidden="true"
      className="after:bg-muted hidden h-5 shrink-0 items-center justify-center after:h-1.5 after:w-25 after:rounded-full [[data-presentation=sheet]>&]:flex"
      data-slot="sheet-grip"
      ref={attachSheetGrip}
    />
  );
}
