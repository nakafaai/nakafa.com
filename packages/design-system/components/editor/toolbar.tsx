"use client";

import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { RichEditorStyle } from "@repo/design-system/components/editor/style";
import {
  RichEditorBlocks,
  RichEditorHistory,
  RichEditorInline,
  RichEditorLists,
  RichEditorMarks,
} from "@repo/design-system/components/editor/tools";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { useCurrentEditor } from "@tiptap/react";
import { Array as Arr } from "effect";
import { type ComponentProps, useLayoutEffect, useRef, useState } from "react";

interface RichEditorToolbarProps {
  /** The names a reader hears and sees for each control. */
  labels: ComponentProps<typeof RichEditorBlocks>["labels"] &
    ComponentProps<typeof RichEditorHistory>["labels"] &
    ComponentProps<typeof RichEditorInline>["labels"] &
    ComponentProps<typeof RichEditorLists>["labels"] &
    ComponentProps<typeof RichEditorMarks>["labels"] &
    ComponentProps<typeof RichEditorStyle>["labels"] & {
      /** The control that opens the groups the row has no room for. */
      more: string;
    };
}

/** The groups of controls, the one a writer needs most first. */
const GROUPS = [
  { name: "history", Tools: RichEditorHistory },
  { name: "style", Tools: RichEditorStyle },
  { name: "marks", Tools: RichEditorMarks },
  { name: "lists", Tools: RichEditorLists },
  { name: "inline", Tools: RichEditorInline },
  { name: "blocks", Tools: RichEditorBlocks },
];

/**
 * Reads which groups the row has no room for. The row keeps one line and lets
 * the groups that do not fit wrap below it, out of sight.
 */
function readWrapped(row: HTMLElement) {
  return Arr.flatMap(Arr.fromIterable(row.children), (group) =>
    group instanceof HTMLElement &&
    group.offsetTop >= row.clientHeight &&
    group.dataset.group !== undefined
      ? [group.dataset.group]
      : []
  );
}

/**
 * One group of controls. A line stands before every group but the first, and a
 * group the row has no room for keeps its place out of sight.
 */
function RichEditorGroup(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 before:me-1 before:h-5 before:w-px before:bg-border first:before:hidden data-wrapped:invisible"
      {...props}
    />
  );
}

/**
 * The formatting controls of the editor it sits in, on one line: history, the
 * style of the paragraph, marks, lists, and blocks. The groups that do not fit
 * the width move behind a last control that opens them, so the line never
 * wraps and never scrolls. A pick there closes them and the caret is back in
 * the text. Until the editor exists, every control waits.
 */
export function RichEditorToolbar({ labels }: RichEditorToolbarProps) {
  const { editor } = useCurrentEditor();
  const row = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState<readonly string[]>([]);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const element = row.current;

    if (!element) {
      return;
    }

    /** Keeps the list it has when the same groups are still out of sight. */
    function measure(target: HTMLElement) {
      const next = readWrapped(target);

      setWrapped((current) =>
        Arr.join(current, " ") === Arr.join(next, " ") ? current : next
      );
    }

    measure(element);

    const observer = new ResizeObserver(() => measure(element));
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex items-center gap-1.5 border-b px-2 py-1.5"
      data-slot="editor-toolbar"
      role="toolbar"
    >
      <div
        className="relative flex h-8 min-w-0 flex-1 flex-wrap content-start items-center gap-x-1.5 overflow-hidden"
        ref={row}
      >
        {Arr.map(GROUPS, ({ name, Tools }) => (
          <RichEditorGroup
            data-group={name}
            data-wrapped={Arr.contains(wrapped, name) ? "" : undefined}
            key={name}
          >
            <Tools labels={labels} />
          </RichEditorGroup>
        ))}
      </div>
      {Arr.isReadonlyArrayNonEmpty(wrapped) ? (
        <RichEditorGroup>
          <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger
              render={
                <Button
                  aria-label={labels.more}
                  size="icon-sm"
                  title={labels.more}
                  type="button"
                  variant="ghost"
                />
              }
            >
              <HugeIcons icon={MoreVerticalIcon} />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="flex w-auto flex-col gap-1 p-1.5"
              // A press on a control closes the groups, and the caret goes back
              // to the text. A close from the keyboard returns to the control
              // that opened them.
              finalFocus={(closed) =>
                closed === "keyboard" ? true : (editor?.view.dom ?? true)
              }
              onClick={() => setOpen(false)}
            >
              {Arr.map(
                Arr.filter(GROUPS, ({ name }) => Arr.contains(wrapped, name)),
                ({ name, Tools }) => (
                  <div className="flex items-center gap-0.5" key={name}>
                    <Tools labels={labels} />
                  </div>
                )
              )}
            </PopoverContent>
          </Popover>
        </RichEditorGroup>
      ) : null}
    </div>
  );
}
