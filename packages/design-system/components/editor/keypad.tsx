import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import {
  KEY_SETS,
  type KeySet,
  keyFace,
  SET_SIGNS,
} from "@repo/design-system/components/editor/keys";
import { drawFormula } from "@repo/design-system/components/editor/render";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { useState } from "react";

/** What the keys under the sets do: move the caret one character, or delete the one before it. */
const KeypadCommand = Schema.Literals([
  "deleteBackward",
  "moveToNextChar",
  "moveToPreviousChar",
]);
type KeypadCommand = typeof KeypadCommand.Type;

/**
 * The formula keypad of Nakafa: the numbers, the functions, the symbols, the Greek letters, chemistry and physics as the
 * design system's outline keys in six sets (`KEY_SETS`), each key drawn by KaTeX as the lesson page draws math, then the keys that move the caret
 * and delete. A key types into the formula field through `onInsert`, and a press keeps the focus in the field, so its
 * caret stays where the writer left it.
 */
export function FormulaKeypad({
  labels,
  onCommand,
  onInsert,
}: {
  labels: Record<KeySet | "delete" | "left" | "right", string>;
  /** Moves the caret or deletes the character before it. */
  onCommand: (command: KeypadCommand) => void;
  /** Types one key's LaTeX at the caret. */
  onInsert: (latex: string) => void;
}) {
  const [set, setSet] = useState<KeySet>("numbers");

  return (
    <div className="grid gap-2" data-slot="formula-keypad">
      <ToggleGroup
        className="w-full"
        onValueChange={(next) =>
          Option.map(
            Arr.findFirst(Rec.keys(KEY_SETS), (name) => name === next),
            setSet
          )
        }
        size="sm"
        value={set}
      >
        {Arr.map(Rec.keys(KEY_SETS), (name) => (
          <ToggleGroupItem
            aria-label={labels[name]}
            key={name}
            onMouseDown={(event) => event.preventDefault()}
            value={name}
          >
            <KeyFace latex={SET_SIGNS[name]} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid grid-cols-6 gap-1">
        {Arr.map(KEY_SETS[set], (latex) => (
          <Button
            aria-label={keyFace(latex)}
            className="h-9 px-0"
            key={latex}
            onClick={() => onInsert(latex)}
            onMouseDown={(event) => event.preventDefault()}
            size="sm"
            type="button"
            variant="outline"
          >
            <KeyFace latex={keyFace(latex)} />
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1">
        <CommandKey
          icon={ArrowLeft01Icon}
          label={labels.left}
          onPress={() => onCommand("moveToPreviousChar")}
        />
        <CommandKey
          icon={ArrowRight01Icon}
          label={labels.right}
          onPress={() => onCommand("moveToNextChar")}
        />
        <div className="col-span-3" />
        <CommandKey
          icon={Delete02Icon}
          label={labels.delete}
          onPress={() => onCommand("deleteBackward")}
        />
      </div>
    </div>
  );
}

/** A key's face: its formula drawn by KaTeX, inline and at the key's text size. */
function KeyFace({ latex }: { latex: string }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none text-sm"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
      dangerouslySetInnerHTML={{ __html: drawFormula(latex, false) }}
    />
  );
}

/** A key that moves the caret or deletes, named for assistive technology and drawn with its icon. */
function CommandKey({
  icon,
  label,
  onPress,
}: {
  icon: typeof Delete02Icon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="h-9"
      onClick={onPress}
      onMouseDown={(event) => event.preventDefault()}
      size="sm"
      type="button"
      variant="outline"
    >
      <HugeIcons icon={icon} />
    </Button>
  );
}
