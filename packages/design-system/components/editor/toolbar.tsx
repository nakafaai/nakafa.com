import { MoreVerticalIcon } from "@hugeicons/core-free-icons";
import { EditorArabicKeyboard } from "@repo/design-system/components/editor/arabic";
import {
  DocumentLists,
  RichEditorBlocks,
  RichEditorLists,
} from "@repo/design-system/components/editor/block";
import type { DocumentEditorInstance } from "@repo/design-system/components/editor/document";
import {
  DocumentMarks,
  RichEditorMarks,
} from "@repo/design-system/components/editor/format";
import {
  editorBar,
  editorRow,
} from "@repo/design-system/components/editor/frame";
import { DocumentInsert } from "@repo/design-system/components/editor/insert";
import { RichEditorStyle } from "@repo/design-system/components/editor/style";
import { DocumentTable } from "@repo/design-system/components/editor/table";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { RichEditorHistory } from "@repo/design-system/components/editor/tools";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { EditorContext, useCurrentEditor } from "@tiptap/react";
import { cn } from "cn";
import { Array as Arr } from "effect";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** One group of controls of a bar: its name, which the bar keys it by, and the controls it holds. */
interface EditorGroup {
  readonly name: string;
  readonly tools: ReactNode;
}

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
function BarGroup(props: Omit<ComponentProps<"div">, "className">) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 before:me-1 before:h-5 before:w-px before:bg-border first:before:hidden data-wrapped:invisible"
      {...props}
    />
  );
}

/**
 * The one-line bar of controls above an editor, which it reads through `useCurrentEditor`.
 * The groups that do not fit the width move behind a last control that opens them, so the
 * line never wraps and never scrolls. They close when a control there has acted and the
 * caret is back in the text. A control that opens its own choices, such as the link field,
 * keeps them open until the writer has chosen. Until the editor exists, every control waits.
 */
function EditorBar({
  align,
  className,
  groups,
  more,
}: {
  /** Where the controls gather in the row: at its start, or in its middle over a page. */
  align?: "center" | "start";
  /** Extra classes of the bar, such as its place in the page. */
  className?: string;
  /** The groups of controls, the one a writer needs most first. */
  groups: readonly EditorGroup[];
  /** The name of the control that opens the groups the row has no room for. */
  more: string;
}) {
  const { editor } = useCurrentEditor();
  const row = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState<readonly string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!(open && editor)) {
      return;
    }

    /** Every control gives the caret back to the text when it acts. */
    function close() {
      setOpen(false);
    }

    editor.on("focus", close);

    return () => {
      editor.off("focus", close);
    };
  }, [editor, open]);

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
      className={cn(editorBar(), className)}
      data-slot="editor-toolbar"
      role="toolbar"
    >
      <div className={editorRow({ align })} ref={row}>
        {Arr.map(groups, ({ name, tools }) => (
          <BarGroup
            data-group={name}
            data-wrapped={Arr.contains(wrapped, name) ? "" : undefined}
            key={name}
          >
            {tools}
          </BarGroup>
        ))}
      </div>
      {Arr.isReadonlyArrayNonEmpty(wrapped) ? (
        <BarGroup>
          <Popover onOpenChange={setOpen} open={open}>
            <ToolHint label={more}>
              <PopoverTrigger
                render={
                  <Button
                    aria-label={more}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <HugeIcons icon={MoreVerticalIcon} />
              </PopoverTrigger>
            </ToolHint>
            <PopoverContent
              align="end"
              className="flex w-auto flex-col gap-1 p-1.5"
              // After a press the caret stays in the text. A close from the
              // keyboard returns to the control that opened the groups.
              finalFocus={(closed) =>
                closed === "keyboard" ? true : (editor?.view.dom ?? true)
              }
            >
              {Arr.map(
                Arr.filter(groups, ({ name }) => Arr.contains(wrapped, name)),
                ({ name, tools }) => (
                  <div className="flex items-center gap-0.5" key={name}>
                    {tools}
                  </div>
                )
              )}
            </PopoverContent>
          </Popover>
        </BarGroup>
      ) : null}
    </div>
  );
}

interface RichEditorToolbarProps {
  /** The names a reader hears and sees for each control. */
  labels: ComponentProps<typeof RichEditorBlocks>["labels"] &
    ComponentProps<typeof RichEditorHistory>["labels"] &
    ComponentProps<typeof RichEditorLists>["labels"] &
    ComponentProps<typeof RichEditorMarks>["labels"] &
    ComponentProps<typeof RichEditorStyle>["labels"] & {
      /** The control that opens the Arabic keypad. */
      arabic: string;
      /** The control that opens the groups the row has no room for. */
      more: string;
    };
}

/**
 * The formatting controls of the Memory editor, on one line: history, the style of the
 * paragraph, the marks with the link, the lists, the blocks to insert, and the Arabic keypad. Each group holds
 * two buttons at most, a group of toggles, or one menu.
 */
export function RichEditorToolbar({ labels }: RichEditorToolbarProps) {
  return (
    <EditorBar
      groups={[
        { name: "history", tools: <RichEditorHistory labels={labels} /> },
        { name: "style", tools: <RichEditorStyle labels={labels} /> },
        { name: "marks", tools: <RichEditorMarks labels={labels} /> },
        { name: "lists", tools: <RichEditorLists labels={labels} /> },
        { name: "blocks", tools: <RichEditorBlocks labels={labels} /> },
        {
          name: "arabic",
          tools: <EditorArabicKeyboard label={labels.arabic} />,
        },
      ]}
      more={labels.more}
    />
  );
}

interface DocumentToolbarProps {
  /** The editor the controls act on, or none while there is none, so every control waits. */
  editor: DocumentEditorInstance | null;
  /** The names a writer hears and sees for each control of the document toolbar. */
  labels: ComponentProps<typeof DocumentInsert>["labels"] &
    ComponentProps<typeof DocumentLists>["labels"] &
    ComponentProps<typeof DocumentMarks>["labels"] &
    ComponentProps<typeof DocumentTable>["labels"] &
    ComponentProps<typeof RichEditorHistory>["labels"] &
    ComponentProps<typeof RichEditorStyle>["labels"] & {
      /** The control that opens the Arabic keypad. */
      arabic: string;
      /** The control that opens the groups the row has no room for. */
      more: string;
    };
}

/**
 * The toolbar of an assessment document, on one line in the middle of its bar: history, the style of
 * the paragraph, the marks with the link, the lists, the blocks to insert, tables, and the Arabic keypad. Each group holds
 * two buttons at most, a group of toggles, or one menu. It offers only the blocks and marks of the
 * contract. It is drawn by its caller, outside the document, and acts on the editor it reads
 * through `useCurrentEditor`.
 */
export function DocumentToolbar({ editor, labels }: DocumentToolbarProps) {
  return (
    <EditorContext value={{ editor }}>
      <EditorBar
        align="center"
        groups={[
          { name: "history", tools: <RichEditorHistory labels={labels} /> },
          { name: "style", tools: <RichEditorStyle labels={labels} /> },
          { name: "marks", tools: <DocumentMarks labels={labels} /> },
          { name: "lists", tools: <DocumentLists labels={labels} /> },
          { name: "insert", tools: <DocumentInsert labels={labels} /> },
          { name: "table", tools: <DocumentTable labels={labels} /> },
          {
            name: "arabic",
            tools: <EditorArabicKeyboard label={labels.arabic} />,
          },
        ]}
        more={labels.more}
      />
    </EditorContext>
  );
}
