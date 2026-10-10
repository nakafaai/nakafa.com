"use client";

import { useCallbackRef } from "@mantine/hooks";
import {
  EditorFrame,
  EditorStatic,
} from "@repo/design-system/components/editor/frame";
import {
  flattenText,
  toDocument,
} from "@repo/design-system/components/editor/text";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import { CharacterCount, Placeholder, UndoRedo } from "@tiptap/extensions";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorProps } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { String as Str } from "effect";
import { useEffect, useMemo, useState } from "react";

/** The document holds exactly one paragraph, so the text can never grow a second line. */
const SingleParagraph = Document.extend({ content: "paragraph" });

interface PlainEditorProps {
  /** The accessible name of the editing surface. */
  label: string;
  /** The most characters the text may hold. */
  limit: number;
  /** Called when the reader presses Escape. */
  onCancel: () => void;
  /** Called with the whole text after each edit. */
  onChange: (text: string) => void;
  /** Called when the reader presses Enter. */
  onSubmit: () => void;
  /** The hint shown while the text is empty. */
  placeholder: string;
  /** The text the editor holds. */
  value: string;
}

/**
 * Edits one line of plain text. Enter submits, Escape cancels, pasted text is
 * flattened to one line, and undo and redo work. Until the editor exists, the
 * text shows read-only in the same box, so loading moves nothing.
 *
 * Load it with `next/dynamic` and `ssr: false`: the editor needs the browser
 * and brings the editing library with it.
 */
export function PlainEditor({
  label,
  limit,
  onCancel,
  onChange,
  onSubmit,
  placeholder,
  value,
}: PlainEditorProps) {
  const cancel = useCallbackRef(onCancel);
  const change = useCallbackRef(onChange);
  const submit = useCallbackRef(onSubmit);
  const [content] = useState(() => toDocument(value));
  const extensions = useMemo(
    () => [
      SingleParagraph,
      Paragraph,
      Text,
      UndoRedo,
      CharacterCount.configure({ limit }),
      Placeholder.configure({ placeholder }),
    ],
    [limit, placeholder]
  );
  const editorProps = useMemo<EditorProps>(
    () => ({
      attributes: { "aria-label": label, "aria-multiline": "false" },
      handleKeyDown: (_view, event) => {
        if (event.isComposing) {
          return false;
        }
        if (event.key === "Enter") {
          submit();
          return true;
        }
        if (event.key === "Escape") {
          cancel();
          return true;
        }
        return false;
      },
      // Dropped text takes this path too, so no source adds a second line.
      transformPasted: (slice, view) => {
        const text = flattenText(
          slice.content.textBetween(0, slice.content.size, " ")
        );

        return Str.isEmpty(text)
          ? Slice.empty
          : new Slice(Fragment.from(view.state.schema.text(text)), 0, 0);
      },
    }),
    [cancel, label, submit]
  );
  const editor = useEditor({
    autofocus: "end",
    content,
    editorProps,
    extensions,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => change(current.getText()),
  });

  // The text can also change from outside, such as a reset after a failed save.
  useEffect(() => {
    if (editor && editor.getText() !== value) {
      editor.commands.setContent(toDocument(value), { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <EditorFrame>
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <EditorStatic>{value}</EditorStatic>
      )}
    </EditorFrame>
  );
}
