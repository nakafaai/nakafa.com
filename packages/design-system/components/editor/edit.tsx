import { KeyboardIcon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { FormulaKeypad } from "@repo/design-system/components/editor/keypad";
import {
  drawFormula,
  formulaProblem,
} from "@repo/design-system/components/editor/render";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { fieldBoxVariants } from "@repo/design-system/lib/input";
import { cn } from "cn";
import { Effect, Option, Schema } from "effect";
import type * as MathLive from "mathlive";
import {
  type ComponentProps,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** MathLive, which an editor needs only when its popover opens, so no page's first JavaScript holds it. */
class MathLiveUnavailable extends Schema.TaggedError<MathLiveUnavailable>()(
  "MathLiveUnavailable",
  { reason: Schema.String }
) {}

/** Loads MathLive. A failed load leaves the LaTeX tab working, so the caller takes no failure. */
const loadMathLive = Effect.tryPromise({
  catch: (cause) => new MathLiveUnavailable({ reason: String(cause) }),
  try: () => import("mathlive"),
});

/**
 * The MathLive field, made once MathLive has loaded, in a box drawn like a text field. The field and
 * the LaTeX text show one formula: a change in either one reaches the other through `value`, and each
 * keystroke of the field reports its LaTeX. MathLive's own menu, keyboard toggle and virtual keyboard
 * never show (`styles/globals.css`); the box's Keyboard button opens Nakafa's keypad under the field,
 * which types through the element that `field` holds, and stays pressed while the keypad shows.
 */
function MathField({
  field,
  keyboard,
  keypad,
  mathlive,
  onInput,
  onKeypad,
  value,
}: {
  /** Receives the MathLive element, which the keypad types into. */
  field: RefObject<MathLive.MathfieldElement | null>;
  /** The name of the button that opens the keypad. */
  keyboard: string;
  /** Whether the keypad shows. */
  keypad: boolean;
  mathlive: typeof MathLive;
  onInput: (latex: string) => void;
  /** Opens or closes the keypad. */
  onKeypad: () => void;
  value: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const input = useCallbackRef(onInput);

  useEffect(() => {
    const element = new mathlive.MathfieldElement();
    element.mathVirtualKeyboardPolicy = "manual";
    // The menu takes its items once the field has mounted; an empty menu leaves no context menu of MathLive's own.
    element.addEventListener("mount", () => {
      element.menuItems = [];
    });
    element.addEventListener("input", () => input(element.value));
    host.current?.append(element);
    field.current = element;
    return () => {
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
        "h-auto min-h-12 items-center gap-1 py-1 pe-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      )}
    >
      <div className="min-w-0 flex-1" ref={host} />
      <Button
        aria-label={keyboard}
        aria-pressed={keypad}
        className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        onClick={() => {
          field.current?.focus();
          onKeypad();
        }}
        // The press keeps the focus in the field, so its caret stays where the writer left it.
        onMouseDown={(event) => event.preventDefault()}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={KeyboardIcon} />
      </Button>
    </div>
  );
}

/**
 * The editor of one formula, opened by a press on the drawn formula. The popover holds two tabs:
 * the MathLive field, which a phone keyboard types into, and the LaTeX text. MathLive is loaded
 * when the popover opens, so no page's first JavaScript holds it. Closing the popover saves the
 * formula, unless the writer pressed Escape, which keeps the formula as it was. A blank formula
 * is never saved, and a formula that KaTeX does not parse is saved and drawn as its error, with
 * KaTeX's reason in one sentence.
 */
export function FormulaEdit({
  block,
  labels,
  latex,
  onSave,
}: {
  block: boolean;
  /**
   * The names of the editor: the popover's two tabs, the control that opens it, and the
   * sentence before KaTeX's reason when a formula does not parse.
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
  };
  latex: string;
  onSave: (latex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(latex);
  const [mathlive, setMathlive] = useState<Option.Option<typeof MathLive>>(
    Option.none()
  );
  const discarded = useRef(false);
  const field = useRef<MathLive.MathfieldElement | null>(null);
  const [keypad, setKeypad] = useState(false);
  const problem = useMemo(() => Effect.runSync(formulaProblem(draft)), [draft]);

  /** Opens the editor on the saved formula, and loads MathLive for its field. */
  function openEditor(next: boolean) {
    if (!next) {
      setOpen(false);
      if (!discarded.current && draft.trim() !== "") {
        onSave(draft.trim());
      }
      return;
    }
    discarded.current = false;
    setDraft(latex);
    setOpen(true);
    Effect.runFork(
      loadMathLive.pipe(
        Effect.option,
        Effect.map((loaded) => setMathlive(loaded))
      )
    );
  }

  /** Escape keeps the formula as it was saved, so the popover closes without a save. */
  function discardOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") {
      discarded.current = true;
    }
  }

  return (
    <Popover onOpenChange={openEditor} open={open}>
      <PopoverTrigger
        render={
          <button
            aria-label={labels.open}
            className={
              block
                ? "block w-full cursor-pointer overflow-x-auto text-start"
                : "inline cursor-pointer"
            }
            type="button"
          />
        }
      >
        <FormulaMarkup block={block} latex={latex} />
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="flex w-80 flex-col gap-3 p-3"
        onKeyDown={discardOnEscape}
      >
        <Tabs defaultValue="formula">
          <TabsList>
            <TabsTab value="formula">{labels.formula}</TabsTab>
            <TabsTab value="latex">{labels.latex}</TabsTab>
          </TabsList>
          <TabsPanel value="formula">
            {Option.match(mathlive, {
              onNone: () => null,
              onSome: (module) => (
                <div className="grid gap-3">
                  <MathField
                    field={field}
                    keyboard={labels.keyboard}
                    keypad={keypad}
                    mathlive={module}
                    onInput={setDraft}
                    onKeypad={() => setKeypad((shown) => !shown)}
                    value={draft}
                  />
                  {keypad ? (
                    <FormulaKeypad
                      labels={labels.keys}
                      onCommand={(command) =>
                        field.current?.executeCommand(command)
                      }
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
              ),
            })}
          </TabsPanel>
          <TabsPanel value="latex">
            <Textarea
              aria-label={labels.latex}
              className="font-mono"
              onChange={(event) => setDraft(event.target.value)}
              // An example of LaTeX, the same in every language.
              placeholder={String.raw`\frac{a}{b}`}
              value={draft}
            />
          </TabsPanel>
        </Tabs>
        {Option.match(problem, {
          onNone: () => null,
          onSome: (reason) => (
            <p className="text-destructive text-sm">
              {labels.invalid} {reason}
            </p>
          ),
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The drawn formula, which KaTeX draws from its LaTeX and never from any other source. The server and
 * the browser draw it alike, so the first HTML already shows the formula, chemistry included.
 */
export function FormulaMarkup({
  block,
  latex,
}: {
  block: boolean;
  latex: string;
}) {
  return (
    <span
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX generates safe HTML while trust remains disabled.
      dangerouslySetInnerHTML={{ __html: drawFormula(latex, block) }}
    />
  );
}
