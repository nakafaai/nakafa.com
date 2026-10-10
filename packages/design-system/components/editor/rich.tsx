"use client";

import {
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  TextBoldIcon,
  TextItalicIcon,
} from "@hugeicons/core-free-icons";
import { useCallbackRef } from "@mantine/hooks";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { EditorProps } from "@tiptap/pm/view";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";

interface RichEditorProps {
  /**
   * The Markdown the editor starts with. Once the editor exists it owns the
   * text and reports every edit through `onChange`, so a later change of this
   * prop does nothing. Mount a new editor to start from other text.
   */
  defaultValue: string;
  /** The names a reader hears for the formatting controls and the editing surface. */
  labels: {
    bold: string;
    bullets: string;
    italic: string;
    numbers: string;
    text: string;
  };
  /** The most characters the text may hold. */
  limit: number;
  /** Called with the whole text as Markdown after each edit. */
  onChange: (markdown: string) => void;
  /** Called when the reader presses Enter with Command or Control. */
  onSubmit: () => void;
  /** The hint shown while the text is empty. */
  placeholder: string;
}

/** One formatting control. It shows as pressed while the caret sits in that format. */
function RichEditorToggle({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
      onClick={onClick}
      // The press must not take the focus from the text, or the caret and the
      // next keystrokes would be lost for a moment.
      onMouseDown={(event) => event.preventDefault()}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      <HugeIcons icon={icon} />
    </Button>
  );
}

/** The formatting controls above the text. They wait until the editor exists. */
function RichEditorToolbar({
  editor,
  labels,
}: {
  editor: Editor | null;
  labels: RichEditorProps["labels"];
}) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      bullets: current?.isActive("bulletList") ?? false,
      italic: current?.isActive("italic") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
    }),
  });

  return (
    <div
      className="flex items-center gap-0.5 border-b px-2 py-1.5"
      data-slot="editor-toolbar"
      role="toolbar"
    >
      <RichEditorToggle
        active={active?.bold ?? false}
        icon={TextBoldIcon}
        label={labels.bold}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <RichEditorToggle
        active={active?.italic ?? false}
        icon={TextItalicIcon}
        label={labels.italic}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <RichEditorToggle
        active={active?.bullets ?? false}
        icon={LeftToRightListBulletIcon}
        label={labels.bullets}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <RichEditorToggle
        active={active?.numbers ?? false}
        icon={LeftToRightListNumberIcon}
        label={labels.numbers}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
    </div>
  );
}

/**
 * Edits rich text and keeps it as Markdown: bold, italic, bulleted and
 * numbered lists, with undo and redo. The toolbar sits above the text, and the
 * text fills the space its parent gives, so the parent decides the height.
 *
 * Load it with `next/dynamic` and `ssr: false`: the editor needs the browser
 * and brings the editing library with it.
 */
export function RichEditor({
  defaultValue,
  labels,
  limit,
  onChange,
  onSubmit,
  placeholder,
}: RichEditorProps) {
  const change = useCallbackRef(onChange);
  const submit = useCallbackRef(onSubmit);
  const [content] = useState(defaultValue);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        heading: false,
        horizontalRule: false,
        link: false,
        strike: false,
        underline: false,
      }),
      Markdown,
      CharacterCount.configure({ limit }),
      Placeholder.configure({ placeholder }),
    ],
    [limit, placeholder]
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: { "aria-label": labels.text, "aria-multiline": "true" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          submit();
          return true;
        }
        return false;
      },
    }),
    [labels.text, submit]
  );
  const editor = useEditor({
    autofocus: "end",
    content,
    contentType: "markdown",
    editorProps,
    extensions,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => change(current.getMarkdown()),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-slot="editor">
      <RichEditorToolbar editor={editor} labels={labels} />
      <EditorContent
        className="min-h-0 flex-1 overflow-y-auto text-sm/relaxed [&_.ProseMirror]:min-h-full [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:outline-none [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_li>p]:m-0 [&_ol+p]:mt-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_p+ol]:mt-2 [&_p+p]:mt-2 [&_p+ul]:mt-2 [&_ul+p]:mt-2 [&_ul]:list-disc [&_ul]:ps-5"
        editor={editor}
      />
    </div>
  );
}
