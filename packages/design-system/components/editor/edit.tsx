import { KeyboardIcon } from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
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
  type KeyboardEvent,
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
 * keystroke of the field reports its LaTeX. MathLive's own menu and keyboard toggle are hidden
 * (`styles/globals.css`); the box's own Keyboard button shows and hides the virtual keyboard, which
 * takes Nakafa's colours, and stays pressed while it shows.
 */
function MathField({
  keyboard,
  mathlive,
  onInput,
  value,
}: {
  /** The name of the button that shows the virtual keyboard. */
  keyboard: string;
  mathlive: typeof MathLive;
  onInput: (latex: string) => void;
  value: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathLive.MathfieldElement | null>(null);
  const input = useCallbackRef(onInput);
  const [shown, setShown] = useState(false);

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
    const keys = window.mathVirtualKeyboard;
    const follow = () => setShown(keys.visible);
    keys.addEventListener("virtual-keyboard-toggle", follow);
    return () => {
      keys.removeEventListener("virtual-keyboard-toggle", follow);
      keys.hide();
      field.current = null;
      element.remove();
    };
  }, [input, mathlive]);

  useEffect(() => {
    const element = field.current;
    if (element && element.value !== value) {
      element.value = value;
    }
  }, [value]);

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
        aria-pressed={shown}
        className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
        onClick={() => {
          field.current?.focus();
          const keys = window.mathVirtualKeyboard;
          if (keys.visible) {
            keys.hide();
            return;
          }
          keys.show();
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
    /** The button that shows the formula keyboard. */
    keyboard: string;
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
                <MathField
                  keyboard={labels.keyboard}
                  mathlive={module}
                  onInput={setDraft}
                  value={draft}
                />
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
