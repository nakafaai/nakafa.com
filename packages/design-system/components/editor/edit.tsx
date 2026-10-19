"use client";

import { useCallbackRef } from "@mantine/hooks";
import {
  drawFormula,
  formulaProblem,
} from "@repo/design-system/components/editor/render";
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
import { Effect, Option, Schema } from "effect";
import type * as MathLive from "mathlive";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

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
 * The MathLive field, made once MathLive has loaded. The field and the LaTeX text show one
 * formula: a change in either one reaches the other through `value`, and each keystroke of
 * the field reports its LaTeX.
 */
function MathField({
  mathlive,
  onInput,
  value,
}: {
  mathlive: typeof MathLive;
  onInput: (latex: string) => void;
  value: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const field = useRef<MathLive.MathfieldElement | null>(null);
  const input = useCallbackRef(onInput);

  useEffect(() => {
    const element = new mathlive.MathfieldElement();
    element.addEventListener("input", () => input(element.value));
    host.current?.append(element);
    field.current = element;
    return () => {
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

  return <div className="min-h-12 rounded-md border px-2 py-1" ref={host} />;
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
    latex: string;
    open: string;
  };
  latex: string;
  onSave: (latex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(latex);
  const [problem, setProblem] = useState<Option.Option<string>>(Option.none());
  const [mathlive, setMathlive] = useState<Option.Option<typeof MathLive>>(
    Option.none()
  );
  const discarded = useRef(false);

  /** Keeps the draft and checks it in the same event, so the sentence is never a step behind. */
  function change(next: string) {
    setDraft(next);
    setProblem(Effect.runSync(formulaProblem(next)));
  }

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
    setProblem(Effect.runSync(formulaProblem(latex)));
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
                <MathField mathlive={module} onInput={change} value={draft} />
              ),
            })}
          </TabsPanel>
          <TabsPanel value="latex">
            <Textarea
              aria-label={labels.latex}
              className="font-mono"
              onChange={(event) => change(event.target.value)}
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

/** The drawn formula, which KaTeX draws from its LaTeX and never from any other source. */
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
