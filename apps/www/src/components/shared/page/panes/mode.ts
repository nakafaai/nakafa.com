import { createContext } from "react";

/**
 * Where a detail draws, and how its header closes it: beside the first pane, where a row's
 * detail closes and an always-on detail does not, or in the phone's sheet, which closes itself.
 * It holds the close action, a function, so it is a plain shape.
 */
interface PaneMode {
  /** Closes the detail from its header; none for an always-on detail beside the first pane. */
  readonly close: (() => void) | undefined;
  readonly place: "aside" | "sheet";
}

/**
 * Where a detail draws and how its header closes it, read with `use()`: a page's panes and the player's sheet
 * provide it.
 */
export const PaneModeContext = createContext<PaneMode>({
  close: undefined,
  place: "aside",
});
