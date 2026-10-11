"use client";

import { useCallbackRef } from "@mantine/hooks";
import { RichEditorToolbar } from "@repo/design-system/components/editor/toolbar";
import { Highlight } from "@tiptap/extension-highlight";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import type { Node } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import type { EditorProps } from "@tiptap/pm/view";
import {
  EditorContent,
  EditorContext,
  Extension,
  useEditor,
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
  /** The hint shown while the text is empty. */
  placeholder: string;
}

/**
 * Refuses every edit that would take the Markdown of the text past `limit`
 * characters, so the text a reader sees is always text that fits. An edit that
 * makes a text shorter always passes.
 */
const Limit = Extension.create<{ limit: number }>({
  addOptions: () => ({ limit: 0 }),
  addProseMirrorPlugins() {
    const { editor, options } = this;
    const size = (doc: Node) =>
      editor.markdown?.serialize(doc.toJSON()).trim().length ?? 0;

    return [
      new Plugin({
        filterTransaction: (transaction, state) =>
          !transaction.docChanged ||
          size(transaction.doc) <= options.limit ||
          size(transaction.doc) <= size(state.doc),
      }),
    ];
  },
  name: "limit",
});

/**
 * Edits rich text and keeps it as Markdown: headings, bold, italic, underline,
 * struck, code and highlighted words, links, bulleted, numbered and task
 * lists, quotes, code blocks and dividers, with undo and redo. The toolbar
 * sits above the text, and the text fills the space its parent gives, so the
 * parent decides the height.
 *
 * Load it with `next/dynamic` and `ssr: false`: the editor needs the browser
 * and brings the editing library with it.
 */
export function RichEditor({
  defaultValue,
  label,
  labels,
  limit,
  onChange,
  onClose,
  placeholder,
}: RichEditorProps) {
  const change = useCallbackRef(onChange);
  const close = useCallbackRef(onClose);
  const [content] = useState(defaultValue);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        dropcursor: false,
        gapcursor: false,
        heading: { levels: [1, 2, 3] },
        link: { autolink: true, defaultProtocol: "https", openOnClick: false },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
      Limit.configure({ limit }),
      Placeholder.configure({ placeholder }),
    ],
    [limit, placeholder]
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: { "aria-label": label, "aria-multiline": "true" },
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
    autofocus: "end",
    content,
    contentType: "markdown",
    editorProps,
    extensions,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => change(current.getMarkdown()),
  });
  const context = useMemo(() => ({ editor }), [editor]);

  return (
    <EditorContext value={context}>
      <div className="flex min-h-0 flex-1 flex-col" data-slot="editor">
        <RichEditorToolbar labels={labels} />
        <EditorContent
          className="min-h-0 flex-1 overflow-y-auto text-sm/relaxed [&_.ProseMirror>*+*]:mt-2 [&_.ProseMirror]:min-h-full [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:outline-none [&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:float-left [&_.is-editor-empty]:before:h-0 [&_.is-editor-empty]:before:text-muted-foreground [&_.is-editor-empty]:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground [&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_h1]:font-semibold [&_h1]:text-xl [&_h2]:font-semibold [&_h2]:text-lg [&_h3]:font-semibold [&_h3]:text-base [&_hr]:my-3 [&_li>p]:m-0 [&_mark]:rounded-sm [&_mark]:bg-amber-200 [&_mark]:px-0.5 [&_mark]:text-amber-950 [&_ol]:list-decimal [&_ol]:ps-5 [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_ul:not([data-type=taskList])]:list-disc [&_ul:not([data-type=taskList])]:ps-5 [&_ul[data-type=taskList]_li>div]:min-w-0 [&_ul[data-type=taskList]_li>div]:flex-1 [&_ul[data-type=taskList]_li>label]:mt-0.5 [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2"
          editor={editor}
        />
      </div>
    </EditorContext>
  );
}
