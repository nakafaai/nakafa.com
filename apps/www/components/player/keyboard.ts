import { Option } from "effect";

/** What one player shortcut asks the player to do. */
export type PlayerKeyIntent =
  | { readonly kind: "flag" }
  | { readonly kind: "navigator" }
  | { readonly index: number; readonly kind: "pick" }
  | { readonly delta: -1 | 1; readonly kind: "step" };

/** The parts of a keyboard event the shortcut map reads. */
export interface PlayerKeyEvent {
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly defaultPrevented: boolean;
  readonly isComposing: boolean;
  readonly key: string;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly shiftKey: boolean;
}

/** Where the key landed and what the player is showing. */
export interface PlayerKeyContext {
  /** Inside a widget that owns arrow keys, such as a radio group. */
  readonly composite: boolean;
  /** Inside an input, textarea, select, or editable content. */
  readonly editable: boolean;
  readonly locked: boolean;
  readonly overlay: boolean;
}

const PICK_KEYS = ["1", "2", "3", "4", "5"];

/** Elements that take typed text, so every letter and digit stays theirs. */
const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/** Widgets that move their own selection or value with arrow keys. */
const COMPOSITE_SELECTOR = [
  "application",
  "combobox",
  "grid",
  "listbox",
  "menu",
  "menubar",
  "menuitem",
  "option",
  "radio",
  "radiogroup",
  "slider",
  "spinbutton",
  "tab",
  "tablist",
  "toolbar",
  "tree",
]
  .map((role) => `[role='${role}']`)
  .join(", ");

/** Classifies where a key landed, for shortcuts and scroll handling. */
export function readKeyTarget(
  target: EventTarget | null
): Pick<PlayerKeyContext, "composite" | "editable"> {
  if (!(target instanceof Element)) {
    return { composite: false, editable: false };
  }
  return {
    composite: target.closest(COMPOSITE_SELECTOR) !== null,
    editable: target.closest(EDITABLE_SELECTOR) !== null,
  };
}

/** Maps one keydown to a player intent, leaving typing and widgets alone. */
export function readPlayerKey(
  event: PlayerKeyEvent,
  context: PlayerKeyContext
): Option.Option<PlayerKeyIntent> {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.isComposing ||
    event.defaultPrevented ||
    context.editable ||
    context.overlay
  ) {
    return Option.none();
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    return context.composite
      ? Option.none()
      : Option.some({
          delta: event.key === "ArrowLeft" ? -1 : 1,
          kind: "step",
        });
  }
  if (event.repeat) {
    return Option.none();
  }
  if (event.key === "g" || event.key === "G") {
    return Option.some({ kind: "navigator" });
  }
  if (context.locked) {
    return Option.none();
  }
  if (event.key === "f" || event.key === "F") {
    return Option.some({ kind: "flag" });
  }
  const index = PICK_KEYS.indexOf(event.key);
  return index === -1 ? Option.none() : Option.some({ index, kind: "pick" });
}
