import { useReducer } from "react";

/** The dialog a menu showed last, which of its openings this is, and whether it still shows. */
interface MenuDialog<Kind extends string> {
  readonly key: number;
  readonly kind: Kind | null;
  readonly open: boolean;
}

const NO_DIALOG = { key: 0, kind: null, open: false };

/** A press on a kind starts a new opening of it, and a boolean closes the dialog or brings the same opening back. */
function stepDialog<Kind extends string>(
  dialog: MenuDialog<Kind>,
  press: Kind | boolean
): MenuDialog<Kind> {
  return typeof press === "boolean"
    ? { ...dialog, open: press }
    : { key: dialog.key + 1, kind: press, open: true };
}

/**
 * Which one of a menu's dialogs shows, as one state, so no two can show at once.
 *
 * A dialog that starts from the record renders while `kind` names it, under `key`: each opening
 * mounts it fresh, and it stays mounted after it closes, so it plays its exit. A confirmation, or a
 * dialog that keeps what it holds between openings, stays mounted and reads only `isOpen`, because a
 * drawer that mounts already open skips its slide. `setOpen(true)` brings a closed dialog back under
 * its key, as a refused save does, so what was typed stays.
 */
export function useDialogs<Kind extends string>() {
  const [dialog, step] = useReducer(stepDialog<Kind>, NO_DIALOG);

  return {
    close: () => step(false),
    isOpen: (kind: Kind) => dialog.open && dialog.kind === kind,
    key: dialog.key,
    kind: dialog.kind,
    setOpen: (open: boolean) => step(open),
    show: (kind: Kind) => step(kind),
  };
}
