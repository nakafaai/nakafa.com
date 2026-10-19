"use client";

import { useCallbackRef } from "@mantine/hooks";
import { editableState } from "@repo/design-system/components/editor/editable";
import {
  editorContent,
  editorDocument,
  editorPlaceholder,
} from "@repo/design-system/components/editor/frame";
import type { AnyExtension, Editor } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import type { Transaction } from "@tiptap/pm/state";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
import { cn } from "cn";
import { type ReactNode, useMemo } from "react";

/** The focus callback of an editor that has none, so the editor always calls one. */
const noFocus = () => undefined;

/** The Tiptap editor of a document, which a caller holds once the editor exists. */
export type DocumentEditorInstance = Editor;

interface DocumentEditorProps {
  /**
   * Controls and other parts drawn above the text. They read the editor through
   * `useCurrentEditor`, and they stay out of the document.
   */
  children?: ReactNode;
  /** The extensions that make the document the caller holds, built once by the caller. */
  extensions: readonly AnyExtension[];
  /** The accessible name of the editing surface. */
  label: string;
  /** Called after each transaction that changes the document, including one that another editor brought in. */
  onChange: (transaction: Transaction) => void;
  /** Called once with the editor, as soon as it exists. */
  onEditor: (editor: Editor) => void;
  /** Called with the editor when it takes focus, so a caller can make it the editor its controls act on. */
  onFocus?: (editor: Editor) => void;
  /** The hint shown while the document is empty. */
  placeholder: string;
  /** The room the text takes at least, so a short text such as an option takes one line. */
  size?: "line" | "page";
}

/**
 * Edits a document of the given extensions. It keeps no text of its own: the document is
 * the editor's state, and a caller that syncs the document (ADR 0028) reads and changes that
 * state through the editor it receives. The editor starts read-only, and says so to
 * assistive technology, so a caller turns editing on once the document is open. The text
 * takes the same classes whether the caller edits it or only reads it, so a reader sees the
 * document as the editor draws it. Load it with `lazyComponent` and `ssr: false`, as the
 * editor brings the editing library with it.
 */
export function DocumentEditor({
  children,
  extensions,
  label,
  onChange,
  onEditor,
  onFocus,
  placeholder,
  size = "page",
}: DocumentEditorProps) {
  const change = useCallbackRef(onChange);
  const ready = useCallbackRef(onEditor);
  const focused = useCallbackRef(onFocus ?? noFocus);
  const editor = useEditor({
    editable: false,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        class: cn(editorPlaceholder(), editorDocument({ size })),
      },
    },
    extensions: [
      ...extensions,
      Placeholder.configure({ placeholder }),
      editableState,
    ],
    immediatelyRender: false,
    onCreate: ({ editor: current }) => ready(current),
    onFocus: ({ editor: current }) => focused(current),
    onUpdate: ({ transaction }) => change(transaction),
  });
  const context = useMemo(() => ({ editor }), [editor]);

  return (
    <EditorContext value={context}>
      {children}
      <EditorContent className={editorContent({ size })} editor={editor} />
    </EditorContext>
  );
}
