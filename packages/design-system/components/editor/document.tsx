"use client";

import { useCallbackRef } from "@mantine/hooks";
import type { AnyExtension, Editor } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import type { Transaction } from "@tiptap/pm/state";
import { EditorContent, useEditor } from "@tiptap/react";

interface DocumentEditorProps {
  /** The classes of the editing surface, which the caller sets for its typography. */
  className?: string;
  /** The extensions that make the document the caller holds, built once by the caller. */
  extensions: readonly AnyExtension[];
  /** The accessible name of the editing surface. */
  label: string;
  /** Called after each transaction that changes the document, including one that another editor brought in. */
  onChange: (transaction: Transaction) => void;
  /** Called once with the editor, as soon as it exists. */
  onEditor: (editor: Editor) => void;
  /** The hint shown while the document is empty. */
  placeholder: string;
}

/**
 * Edits a document of the given extensions. It keeps no text of its own: the document is
 * the editor's state, and a caller that syncs the document (ADR 0028) reads and changes that
 * state through the editor it receives. The editor starts read-only, so a caller turns
 * editing on once the document is open. Load it with `next/dynamic` and `ssr: false`, as
 * the editor brings the editing library with it.
 */
export function DocumentEditor({
  className,
  extensions,
  label,
  onChange,
  onEditor,
  placeholder,
}: DocumentEditorProps) {
  const change = useCallbackRef(onChange);
  const ready = useCallbackRef(onEditor);
  const editor = useEditor({
    editable: false,
    editorProps: {
      attributes: { "aria-label": label, "aria-multiline": "true" },
    },
    extensions: [...extensions, Placeholder.configure({ placeholder })],
    immediatelyRender: false,
    onCreate: ({ editor: current }) => ready(current),
    onUpdate: ({ transaction }) => change(transaction),
  });

  return <EditorContent className={className} editor={editor} />;
}
