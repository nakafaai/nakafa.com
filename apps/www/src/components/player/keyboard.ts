import type {
  RenderableSpec,
  Selection,
} from "@repo/backend/confect/response/model";
import { Array as Arr, Option, Schema } from "effect";
import type { PlayerOverlay } from "@/components/player/store";

/** What a pressed key asks the player to do. */
const PlayerKeyIntentSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("navigator") }),
  Schema.Struct({ index: Schema.Int, kind: Schema.Literal("pick") }),
  Schema.Struct({
    delta: Schema.Literals([-1, 1]),
    kind: Schema.Literal("step"),
  }),
]);

/** The digit keys that pick an option, in the order of the options. */
const PICK_KEYS = ["1", "2", "3", "4", "5"];

/** Elements that take typed text, so every letter and digit stays theirs. */
const EDITABLE_SELECTOR =
  "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/** Roles of widgets that move their own selection or value with the arrow keys. */
const COMPOSITE_ROLES = [
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
];

const COMPOSITE_SELECTOR = Arr.join(
  Arr.map(COMPOSITE_ROLES, (role) => `[role='${role}']`),
  ", "
);

/** Classifies where a key landed, so the shortcuts leave typing and the widgets that own a key alone. */
export function readKeyTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return { composite: false, editable: false };
  }
  return {
    composite: target.closest(COMPOSITE_SELECTOR) !== null,
    editable: target.closest(EDITABLE_SELECTOR) !== null,
  };
}

/**
 * Maps one keydown to what the player does, and leaves typing and widgets that
 * own the key alone. The arrows step, `1` to `5` pick an option, and `G` opens
 * and closes the navigator. While the finish dialog is open every key is its
 * own, and `composite` and `editable` say where the key landed.
 */
export function readPlayerKey(
  event: {
    altKey: boolean;
    ctrlKey: boolean;
    defaultPrevented: boolean;
    isComposing: boolean;
    key: string;
    metaKey: boolean;
    repeat: boolean;
    shiftKey: boolean;
  },
  context: {
    composite: boolean;
    editable: boolean;
    /** Answers are read-only because time ran out. */
    locked: boolean;
    overlay: PlayerOverlay;
  }
): Option.Option<typeof PlayerKeyIntentSchema.Type> {
  if (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.isComposing ||
    event.defaultPrevented ||
    context.editable ||
    context.overlay === "finish"
  ) {
    return Option.none();
  }
  const togglesNavigator = event.key === "g" || event.key === "G";
  if (context.overlay === "navigator") {
    return togglesNavigator && !event.repeat
      ? Option.some({ kind: "navigator" })
      : Option.none();
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
  if (togglesNavigator) {
    return Option.some({ kind: "navigator" });
  }
  if (context.locked) {
    return Option.none();
  }
  return Option.map(
    Arr.findFirstIndex(PICK_KEYS, (key) => key === event.key),
    (index) => ({ index, kind: "pick" })
  );
}

/** The selection that the option at `index` stands for, when the question is single choice. */
export function pickOption(
  responseSpec: RenderableSpec,
  index: number
): Option.Option<Selection> {
  if (responseSpec.kind !== "single-choice") {
    return Option.none();
  }
  return Option.map(Arr.get(responseSpec.options, index), (option) => ({
    kind: "single-choice",
    optionKey: option.optionKey,
  }));
}
