import {
  CheckListIcon,
  CodeSquareIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  QuoteDownIcon,
} from "@hugeicons/core-free-icons";
import { EditorTools } from "@repo/design-system/components/editor/tools";
import { useCurrentEditor, useEditorState } from "@tiptap/react";

/** Bulleted, numbered and task lists, each its own control, pressed while the caret sits in that list. */
export function RichEditorLists({
  labels,
}: {
  labels: { bullets: string; numbers: string; tasks: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bullets: current?.isActive("bulletList") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
      tasks: current?.isActive("taskList") ?? false,
    }),
  });

  return (
    <EditorTools
      tools={[
        {
          active: state?.bullets ?? false,
          icon: LeftToRightListBulletIcon,
          label: labels.bullets,
          name: "bullets",
          run: () => editor?.chain().focus().toggleBulletList().run(),
        },
        {
          active: state?.numbers ?? false,
          icon: LeftToRightListNumberIcon,
          label: labels.numbers,
          name: "numbers",
          run: () => editor?.chain().focus().toggleOrderedList().run(),
        },
        {
          active: state?.tasks ?? false,
          icon: CheckListIcon,
          label: labels.tasks,
          name: "tasks",
          run: () => editor?.chain().focus().toggleTaskList().run(),
        },
      ]}
    />
  );
}

/** A quote and a code block, pressed while the caret sits in them, and a divider, each its own control. */
export function RichEditorBlocks({
  labels,
}: {
  labels: { codeBlock: string; divider: string; quote: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      codeBlock: current?.isActive("codeBlock") ?? false,
      quote: current?.isActive("blockquote") ?? false,
    }),
  });

  return (
    <EditorTools
      tools={[
        {
          active: state?.quote ?? false,
          icon: QuoteDownIcon,
          label: labels.quote,
          name: "quote",
          run: () => editor?.chain().focus().toggleBlockquote().run(),
        },
        {
          active: state?.codeBlock ?? false,
          icon: CodeSquareIcon,
          label: labels.codeBlock,
          name: "code-block",
          run: () => editor?.chain().focus().toggleCodeBlock().run(),
        },
        {
          icon: MinusSignIcon,
          label: labels.divider,
          name: "divider",
          run: () => editor?.chain().focus().setHorizontalRule().run(),
        },
      ]}
    />
  );
}

/**
 * The lists of an assessment document, bulleted and numbered, each its own control, pressed while
 * the caret sits in that list. A task list is not a block of the contract, so no control offers it.
 */
export function DocumentLists({
  labels,
}: {
  labels: { bullets: string; numbers: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bullets: current?.isActive("bulletList") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <EditorTools
      tools={[
        {
          active: state?.bullets ?? false,
          icon: LeftToRightListBulletIcon,
          label: labels.bullets,
          name: "bullets",
          run: () => editor?.chain().focus().toggleBulletList().run(),
        },
        {
          active: state?.numbers ?? false,
          icon: LeftToRightListNumberIcon,
          label: labels.numbers,
          name: "numbers",
          run: () => editor?.chain().focus().toggleOrderedList().run(),
        },
      ]}
    />
  );
}
