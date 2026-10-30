import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { drawFormula } from "@repo/design-system/components/editor/render";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import { useState } from "react";

/**
 * The keys of each set, as the LaTeX a key inserts. `#?` is an empty slot that the caret moves to next, and `#@`
 * takes what the writer had selected, so a fraction keeps a selected number as its numerator.
 */
const KEY_SETS = {
  numbers: [
    "x",
    "y",
    "7",
    "8",
    "9",
    String.raw`\frac{#@}{#?}`,
    "(",
    ")",
    "4",
    "5",
    "6",
    String.raw`\times`,
    "#@^{2}",
    "#@^{#?}",
    "1",
    "2",
    "3",
    "-",
    String.raw`\sqrt{#@}`,
    String.raw`\sqrt[#?]{#@}`,
    "0",
    ".",
    "=",
    "+",
  ],
  functions: [
    String.raw`\sin`,
    String.raw`\cos`,
    String.raw`\tan`,
    String.raw`\log`,
    String.raw`\ln`,
    "e^{#?}",
    String.raw`\pi`,
    String.raw`\infty`,
    String.raw`\left|#@\right|`,
    "#@_{#?}",
    String.raw`\int_{#?}^{#?}`,
    String.raw`\sum_{#?}^{#?}`,
    String.raw`\lim_{#?\to#?}`,
    String.raw`\vec{#@}`,
    String.raw`\overline{#@}`,
    String.raw`^{\circ}`,
    String.raw`\div`,
    String.raw`\cdot`,
  ],
  symbols: [
    String.raw`\le`,
    String.raw`\ge`,
    "<",
    ">",
    String.raw`\neq`,
    String.raw`\approx`,
    String.raw`\pm`,
    String.raw`\in`,
    String.raw`\notin`,
    String.raw`\subset`,
    String.raw`\cup`,
    String.raw`\cap`,
    String.raw`\emptyset`,
    String.raw`\angle`,
    String.raw`\perp`,
    String.raw`\parallel`,
    String.raw`\Rightarrow`,
    String.raw`\Leftrightarrow`,
  ],
  greek: [
    String.raw`\alpha`,
    String.raw`\beta`,
    String.raw`\gamma`,
    String.raw`\delta`,
    String.raw`\theta`,
    String.raw`\lambda`,
    String.raw`\mu`,
    String.raw`\rho`,
    String.raw`\sigma`,
    String.raw`\phi`,
    String.raw`\omega`,
    String.raw`\Delta`,
    String.raw`\Sigma`,
    String.raw`\Omega`,
  ],
} as const;

/** One set of keys, which the keypad's tabs choose. */
type KeySet = keyof typeof KEY_SETS;

/** What the keys under the sets do: move the caret one character, or delete the one before it. */
const KeypadCommand = Schema.Literals([
  "deleteBackward",
  "moveToNextChar",
  "moveToPreviousChar",
]);
type KeypadCommand = typeof KeypadCommand.Type;

/** The key that names each set in its tab, drawn as the formula it stands for. */
const SET_SIGNS = {
  functions: "f(x)",
  greek: String.raw`\alpha\beta`,
  numbers: "123",
  symbols: String.raw`\le`,
} satisfies Record<KeySet, string>;

/** What a key draws: its LaTeX with each slot shown as an empty square. */
const keyFace = (latex: string) =>
  latex.replaceAll(/#[?@]/gu, String.raw`\square`);

/**
 * The formula keypad of Nakafa: the numbers, the functions, the symbols and the Greek letters as the design system's
 * outline keys in four sets, each key drawn by KaTeX as the lesson page draws math, then the keys that move the caret
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
        variant="outline"
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
          command="moveToPreviousChar"
          icon={ArrowLeft01Icon}
          label={labels.left}
          onCommand={onCommand}
        />
        <CommandKey
          command="moveToNextChar"
          icon={ArrowRight01Icon}
          label={labels.right}
          onCommand={onCommand}
        />
        <div className="col-span-3" />
        <CommandKey
          command="deleteBackward"
          icon={Delete02Icon}
          label={labels.delete}
          onCommand={onCommand}
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
  command,
  icon,
  label,
  onCommand,
}: {
  command: KeypadCommand;
  icon: typeof Delete02Icon;
  label: string;
  onCommand: (command: KeypadCommand) => void;
}) {
  return (
    <Button
      aria-label={label}
      className="h-9"
      onClick={() => onCommand(command)}
      onMouseDown={(event) => event.preventDefault()}
      size="sm"
      type="button"
      variant="secondary"
    >
      <HugeIcons icon={icon} />
    </Button>
  );
}
