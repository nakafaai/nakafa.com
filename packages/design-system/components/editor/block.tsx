import {
  CodeSquareIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
} from "@hugeicons/core-free-icons";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { useCurrentEditor, useEditorState } from "@tiptap/react";

/**
 * The lists, quote and code block of an assessment document. A task list and a divider are
 * not blocks of the contract, so no control offers them.
 */
export function DocumentBlocks({
  labels,
}: {
  labels: {
    bullets: string;
    codeBlock: string;
    numbers: string;
    quote: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bullets: current?.isActive("bulletList") ?? false,
      codeBlock: current?.isActive("codeBlock") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
      quote: current?.isActive("blockquote") ?? false,
    }),
  });

  return (
    <>
      <RichEditorControl
        active={state?.bullets ?? false}
        icon={LeftToRightListBulletIcon}
        label={labels.bullets}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <RichEditorControl
        active={state?.numbers ?? false}
        icon={LeftToRightListNumberIcon}
        label={labels.numbers}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <RichEditorControl
        active={state?.quote ?? false}
        icon={QuoteDownIcon}
        label={labels.quote}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />
      <RichEditorControl
        active={state?.codeBlock ?? false}
        icon={CodeSquareIcon}
        label={labels.codeBlock}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      />
    </>
  );
}
