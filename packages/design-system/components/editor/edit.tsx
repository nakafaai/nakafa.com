import { Delete02Icon, KeyboardIcon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { FormulaKeypad } from "@repo/design-system/components/editor/keypad";
import { formulaProblem } from "@repo/design-system/components/editor/render";
import {
  BlockMath,
  InlineMath,
} from "@repo/design-system/components/markdown/math";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useRequired } from "@repo/design-system/hooks/required";
import { fieldBoxVariants } from "@repo/design-system/lib/input";
import { NEW_FORMULA } from "@repo/editor/math";
import { cn } from "cn";
import { Effect, Fiber, Option, Schema } from "effect";
import type * as MathLive from "mathlive";
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** MathLive, which an editor needs only when its popover opens, so no page's first JavaScript holds it. */
class MathLiveUnavailable extends Schema.TaggedError<
  MathLiveUnavailable,
  { readonly brand: unique symbol }
>()("MathLiveUnavailable", { reason: Schema.String }) {}

/**
 * Loads MathLive. A failed load leaves the LaTeX view working, so the caller takes no failure. MathLive
 * would fetch its fonts and its feedback sounds from folders beside its own script, which the bundle does
 * not hold, so each fetch would fail in the console: the page already carries KaTeX's fonts
 * (`styles/katex.css`), and the field plays no sound.
 */
const loadMathLive = Effect.tryPromise({
  catch: (cause) => new MathLiveUnavailable({ reason: String(cause) }),
  try: () => import("mathlive"),
}).pipe(
  Effect.tap((mathlive) =>
    Effect.sync(() => {
      mathlive.MathfieldElement.fontsDirectory = null;
      mathlive.MathfieldElement.soundsDirectory = null;
    })
  )
);

/**
 * The MathLive field, made once MathLive has loaded, in a box drawn like a text field. The field and
 * the LaTeX text show one formula: a change in either one reaches the other through `value`, and each
 * keystroke of the field reports its LaTeX. MathLive's own menu, keyboard toggle and virtual keyboard
 * never show (`styles/globals.css`); the box's Keyboard button opens Nakafa's keypad under the field,
 * which types through the element that `field` holds, and stays pressed while the keypad shows. The
 * field takes the focus once it has mounted, with a new formula's placeholder selected, so the first
 * keystroke replaces it.
 */
function MathField({
  field,
  keyboard,
  mathlive,
  onInput,
  value,
}: {
  /** Receives the MathLive element, which the keypad types into. */
  field: RefObject<MathLive.MathfieldElement | null>;
  /** The name of the button that opens the keypad. */
  keyboard: string;
  mathlive: typeof MathLive;
  onInput: (latex: string) => void;
  value: string;
}) {
  const { keypad, toggleKeypad } = useKeypad();
  const host = useRef<HTMLDivElement>(null);
  const input = useCallbackRef(onInput);

  useEffect(() => {
    const element = new mathlive.MathfieldElement();
    element.mathVirtualKeyboardPolicy = "manual";
    // The menu takes its items once the field has mounted; an empty menu leaves no context menu of MathLive's own.
    const mounted = () => {
      element.menuItems = [];
      element.focus();
      if (element.value === NEW_FORMULA) {
        element.executeCommand("selectAll");
      }
    };
    const typed = () => input(element.value);
    element.addEventListener("mount", mounted);
    element.addEventListener("input", typed);
    host.current?.append(element);
    field.current = element;
    return () => {
      element.removeEventListener("mount", mounted);
      element.removeEventListener("input", typed);
      field.current = null;
      element.remove();
    };
  }, [field, input, mathlive]);

  useEffect(() => {
    const element = field.current;
    if (element && element.value !== value) {
      element.value = value;
    }
  }, [field, value]);

  return (
    <div
      className={cn(
        fieldBoxVariants(),
        "focus-within:border-ring focus-within:ring-ring/50 h-auto min-h-12 items-center gap-1 py-1 pe-1 focus-within:ring-3"
      )}
    >
      <div className="min-w-0 flex-1" ref={host} />
      <Button
        aria-pressed={keypad}
        className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        onClick={() => {
          field.current?.focus();
          toggleKeypad();
        }}
        // The press keeps the focus in the field, so its caret stays where the writer left it.
        onMouseDown={(event) => event.preventDefault()}
        size="icon-sm"
        tooltip={keyboard}
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={KeyboardIcon} />
      </Button>
    </div>
  );
}

/** Whether Nakafa's keypad shows under the MathLive field, and the press that opens or closes it. */
const KeypadContext = createContext<{
  readonly keypad: boolean;
  readonly toggleKeypad: () => void;
} | null>(null);

/** The keypad's state, from the MathLive view around the field. */
function useKeypad() {
  return useRequired(KeypadContext, "useKeypad");
}

/**
 * The MathLive view of a formula's editor: the field it holds, and Nakafa's keypad under it while the
 * field's Keyboard button holds it open. The keypad types through the element that `field` holds.
 */
function MathPanel({
  children,
  field,
  labels,
}: {
  /** The MathLive field. */
  children: ReactNode;
  field: RefObject<MathLive.MathfieldElement | null>;
  /** The keypad's sets and its keys that move the caret and delete. */
  labels: ComponentProps<typeof FormulaKeypad>["labels"];
}) {
  const [keypad, setKeypad] = useState(false);
  const state = useMemo(
    () => ({ keypad, toggleKeypad: () => setKeypad((shown) => !shown) }),
    [keypad]
  );

  return (
    <KeypadContext value={state}>
      <div className="grid gap-3">
        {children}
        {keypad ? (
          <FormulaKeypad
            labels={labels}
            onCommand={(command) => field.current?.executeCommand(command)}
            onInsert={(key) =>
              field.current?.insert(key, {
                focus: true,
                insertionMode: "replaceSelection",
                selectionMode: "placeholder",
              })
            }
          />
        ) : null}
      </div>
    </KeypadContext>
  );
}

/** The two ways a writer edits a formula in its editor: the MathLive field, or its LaTeX text. */
const FormulaView = Schema.Literals(["formula", "latex"]);

/**
 * The editor of one formula, opened by a press on the drawn formula, or at once for the formula the
 * writer just inserted (`defaultOpen`). The popover reads as a header, a body and a footer: two equal
 * segments choose the MathLive field with Nakafa's keypad or the LaTeX text, the body edits the
 * formula, and the footer removes it. MathLive is loaded while the popover is open, so no page's
 * first JavaScript holds it. Closing the popover saves the formula, unless the writer pressed Escape,
 * which keeps the formula as it was and puts the caret back in the text just after it (`onLeave`).
 * A blank formula is never saved, and a formula that KaTeX does not parse is saved and drawn as its
 * error, with KaTeX's reason in one sentence. The formula the writer just inserted holds nothing yet
 * to keep, so Escape or a blank close takes it back out (`onRemove`) instead of leaving its placeholder.
 * The popover never hands the focus back to the drawn formula, which takes no keys: Escape gives it to
 * the text, and a press outside leaves it where the writer pressed.
 */
export function FormulaEdit({
  block,
  defaultOpen,
  labels,
  latex,
  onLeave,
  onRemove,
  onSave,
}: {
  block: boolean;
  /**
   * Whether the editor opens as the formula first draws, as it does for the formula the writer just
   * inserted, which a close without a formula takes back out.
   */
  defaultOpen: boolean;
  /**
   * The names of the editor: its two views, the control that opens it, the control that removes the
   * formula, and the sentence before KaTeX's reason when a formula does not parse.
   */
  labels: {
    formula: string;
    invalid: string;
    /** The button that opens the formula keypad. */
    keyboard: string;
    /** The keypad's sets and its keys that move the caret and delete. */
    keys: ComponentProps<typeof FormulaKeypad>["labels"];
    latex: string;
    open: string;
    /** The button that removes the formula from the text. */
    remove: string;
  };
  latex: string;
  /** Puts the caret back in the text, just after the formula, when the writer leaves its editor with Escape. */
  onLeave: () => void;
  /** Takes the formula out of the text: on the remove button, and when the formula just inserted closes without one. */
  onRemove: () => void;
  onSave: (latex: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState(latex);
  const [view, setView] = useState<typeof FormulaView.Type>("formula");
  const [mathlive, setMathlive] = useState<Option.Option<typeof MathLive>>(
    Option.none
  );
  const discarded = useRef(false);
  const field = useRef<MathLive.MathfieldElement | null>(null);
  const problem = useMemo(() => Effect.runSync(formulaProblem(draft)), [draft]);

  // MathLive loads the first time the popover shows, which may be as the formula first draws.
  useEffect(() => {
    if (!open || Option.isSome(mathlive)) {
      return;
    }
    const loading = Effect.runFork(
      loadMathLive.pipe(
        Effect.option,
        Effect.map((loaded) => setMathlive(loaded))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(loading));
    };
  }, [mathlive, open]);

  /** Opens the editor on the saved formula, or closes it, saving the draft unless Escape kept the formula as it was. */
  function openEditor(next: boolean, escaped: boolean) {
    if (next) {
      discarded.current = false;
      setDraft(latex);
      setOpen(true);
      return;
    }
    setOpen(false);
    if (!discarded.current && draft.trim() !== "") {
      onSave(draft.trim());
    } else if (defaultOpen) {
      onRemove();
      return;
    }
    if (escaped) {
      onLeave();
    }
  }

  /** Escape keeps the formula as it was saved, so the popover closes without a save. */
  function discardOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      discarded.current = true;
    }
  }

  return (
    <Popover
      onOpenChange={(next, details) =>
        openEditor(next, details.reason === "escape-key")
      }
      open={open}
    >
      {/* A formula on its own line is the lesson's card, a block, so its button spans the line. */}
      <PopoverTrigger
        render={
          <button
            aria-label={labels.open}
            className={cn(
              "cursor-pointer",
              block ? "block w-full text-start" : "inline"
            )}
            type="button"
          />
        }
      >
        <FormulaMarkup block={block} latex={latex} />
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-80 gap-3 p-3"
        finalFocus={false}
        onKeyDown={discardOnEscape}
      >
        <ButtonGroup className="w-full">
          <Button
            aria-pressed={view === "formula"}
            className="flex-1"
            onClick={() => setView("formula")}
            type="button"
          >
            {labels.formula}
          </Button>
          <Button
            aria-pressed={view === "latex"}
            className="flex-1"
            onClick={() => setView("latex")}
            type="button"
          >
            {labels.latex}
          </Button>
        </ButtonGroup>
        {view === "formula" ? (
          Option.match(mathlive, {
            onNone: () => null,
            onSome: (module) => (
              <MathPanel field={field} labels={labels.keys}>
                <MathField
                  field={field}
                  keyboard={labels.keyboard}
                  mathlive={module}
                  onInput={setDraft}
                  value={draft}
                />
              </MathPanel>
            ),
          })
        ) : (
          <Textarea
            aria-label={labels.latex}
            className="font-mono"
            onChange={(event) => setDraft(event.target.value)}
            // An example of LaTeX, the same in every language.
            placeholder={String.raw`\frac{a}{b}`}
            value={draft}
          />
        )}
        {Option.match(problem, {
          onNone: () => null,
          onSome: (reason) => (
            <p className="text-destructive text-sm">
              {labels.invalid} {reason}
            </p>
          ),
        })}
        <Button
          className="self-end"
          onClick={onRemove}
          type="button"
          variant="destructive-outline"
        >
          <HugeIcons icon={Delete02Icon} />
          {labels.remove}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The drawn formula, as the lesson page draws it: a formula on its own line in the lesson's card, and an
 * inline formula with the lesson's inline pieces, both drawn by KaTeX from the LaTeX alone. The server and
 * the browser draw it alike, so the first HTML already shows the formula, chemistry included (`render.ts`
 * registers it on KaTeX).
 */
export function FormulaMarkup({
  block,
  latex,
}: {
  block: boolean;
  latex: string;
}) {
  return block ? <BlockMath math={latex} /> : <InlineMath math={latex} />;
}
