import {
  CheckListIcon,
  CodeSquareIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  PlusSignIcon,
  QuoteDownIcon,
} from "@hugeicons/core-free-icons";
import { EditorMenu } from "@repo/design-system/components/editor/tools";
import { useCurrentEditor, useEditorState } from "@tiptap/react";

/** Bulleted, numbered and task lists, in one menu that shows the list the caret sits in. */
export function RichEditorLists({
  labels,
}: {
  labels: { bullets: string; lists: string; numbers: string; tasks: string };
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
    <EditorMenu
      icon={LeftToRightListBulletIcon}
      label={labels.lists}
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

/** Quotes, code blocks and dividers, in one menu of the blocks a writer inserts. */
export function RichEditorBlocks({
  labels,
}: {
  labels: { codeBlock: string; divider: string; insert: string; quote: string };
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
    <EditorMenu
      icon={PlusSignIcon}
      label={labels.insert}
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
 * The lists of an assessment document, bulleted and numbered, in one menu that shows the list
 * the caret sits in. A task list is not a block of the contract, so no control offers it.
 */
export function DocumentLists({
  labels,
}: {
  labels: { bullets: string; lists: string; numbers: string };
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
    <EditorMenu
      icon={LeftToRightListBulletIcon}
      label={labels.lists}
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
