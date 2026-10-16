"use client";

import { useCallbackRef } from "@mantine/hooks";
import { richOptions } from "@repo/design-system/components/editor/extensions";
import {
  editorDocument,
  editorScroll,
} from "@repo/design-system/components/editor/frame";
import { RichEditorToolbar } from "@repo/design-system/components/editor/toolbar";
import type { EditorProps } from "@tiptap/pm/view";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";

interface RichEditorProps {
  /**
   * Whether the caret goes to the end of the text when the editor mounts. A
   * mount that is closing takes no focus, so the focus stays where the closing
   * left it.
   */
  autoFocus: boolean;
  /**
   * The Markdown the editor starts with. Once the editor exists it owns the
   * text and reports every edit through `onChange`, so a later change of this
   * prop does nothing. Mount a new editor to start from other text.
   */
  defaultValue: string;
  /** The accessible name of the editing surface. */
  label: string;
  /** The names of the toolbar's controls. */
  labels: ComponentProps<typeof RichEditorToolbar>["labels"];
  /** The most characters the Markdown of the text may hold. */
  limit: number;
  /** Called with the whole text as Markdown after each edit. */
  onChange: (markdown: string) => void;
  /** Called when the reader presses Escape in the text. */
  onClose: () => void;
  /**
   * Called when a paste is refused because it would take the Markdown past
   * `limit`, so the reader can be told why nothing was inserted.
   */
  onRefuse: () => void;
  /** The hint shown while the text is empty. */
  placeholder: string;
}

/**
 * Edits rich text and keeps it as Markdown: headings, bold, italic, underline,
 * struck, code and highlighted words, links, bulleted, numbered and task
 * lists, quotes, code blocks and dividers, with undo and redo. The toolbar
 * sits above the text, and the text fills the space its parent gives, so the
 * parent decides the height. Each block takes the direction of its own words.
 *
 * Load it with `next/dynamic` and `ssr: false`: the editor needs the browser
 * and brings the editing library with it. Its view exists from the first
 * render, so the first commit that replaces the saved words already holds the
 * words, and no frame shows an empty document.
 */
export function RichEditor({
  autoFocus,
  defaultValue,
  label,
  labels,
  limit,
  onChange,
  onClose,
  onRefuse,
  placeholder,
}: RichEditorProps) {
  const change = useCallbackRef(onChange);
  const close = useCallbackRef(onClose);
  const refuse = useCallbackRef(onRefuse);
  const [content] = useState(defaultValue);
  const options = useMemo(
    () => richOptions({ limit, onRefuse: refuse, placeholder }),
    [limit, placeholder, refuse]
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        class: editorDocument(),
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          close();
          return true;
        }
        return false;
      },
    }),
    [close, label]
  );
  const editor = useEditor({
    ...options,
    autofocus: autoFocus ? "end" : false,
    content,
    contentType: "markdown",
    editorProps,
    immediatelyRender: true,
    onUpdate: ({ editor: current }) => change(current.getMarkdown()),
  });
  const context = useMemo(() => ({ editor }), [editor]);

  return (
    <EditorContext value={context}>
      <div className="flex min-h-0 flex-1 flex-col" data-slot="editor">
        <RichEditorToolbar labels={labels} />
        <EditorContent className={editorScroll()} editor={editor} />
      </div>
    </EditorContext>
  );
}
