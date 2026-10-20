import { useCallbackRef } from "@mantine/hooks";
import { placeCaret } from "@repo/design-system/components/editor/caret";
import { richOptions } from "@repo/design-system/components/editor/extensions";
import {
  editorDocument,
  editorFrame,
  editorPlaceholder,
  editorScroll,
} from "@repo/design-system/components/editor/frame";
import { RichEditorToolbar } from "@repo/design-system/components/editor/toolbar";
import { EditorPreview } from "@repo/design-system/components/editor/words";
import type { EditorProps } from "@tiptap/pm/view";
import { EditorContent, EditorContext, useEditor } from "@tiptap/react";
import { cn } from "cn";
import {
  type ComponentProps,
  createContext,
  use,
  useMemo,
  useState,
} from "react";

interface RichEditorProps {
  /**
   * Whether the caret goes to the end of the text once the editor exists. A
   * closing editor takes no focus, so the focus stays where the closing left it,
   * and an editor takes no caret from a field the learner is typing in.
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

/** The names of the toolbar's controls, which the editor provides to its toolbar. */
const EditorLabelsContext = createContext<RichEditorProps["labels"] | null>(
  null
);

/** Selects the names of the toolbar's controls from the surrounding editor. */
function useEditorLabels() {
  const labels = use(EditorLabelsContext);
  if (labels === null) {
    // A missing editor is a programmer composition error at this React seam.
    throw new Error("The editor toolbar requires RichEditor.");
  }
  return labels;
}

/** The toolbar above the text, with the names of its controls. */
function EditorToolbar() {
  const labels = useEditorLabels();
  return <RichEditorToolbar labels={labels} />;
}

/**
 * Edits rich text and keeps it as Markdown: headings, bold, italic, underline,
 * struck, code and highlighted words, links, bulleted, numbered and task
 * lists, quotes, code blocks and dividers, with undo and redo. The toolbar
 * sits above the text, and the text fills the space its parent gives, so the
 * parent decides the height. Each block takes the direction of its own words.
 *
 * Load it with `import()` where the learner opens it, not with the page, because
 * it brings the editing library with it. Until the editor exists, the saved
 * words show in its place, drawn the same way, so the words do not move when
 * the editor takes their place.
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
        class: cn(editorPlaceholder(), editorDocument()),
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
    content,
    contentType: "markdown",
    editorProps,
    immediatelyRender: false,
    // The editor's own autofocus takes the focus at its mount whatever the
    // learner has chosen, so the caret is placed here, once the editor exists.
    onCreate: ({ editor: created }) => {
      if (autoFocus) {
        placeCaret(created, document.activeElement);
      }
    },
    onUpdate: ({ editor: current }) => change(current.getMarkdown()),
  });
  const context = useMemo(() => ({ editor }), [editor]);

  // The editor is made after the first render, so the saved words stand in for it
  // until then, drawn the way the editor draws them. The editor replaces them
  // with the same words, and no frame shows an empty document.
  if (editor === null) {
    return <EditorPreview markdown={content} placeholder={placeholder} />;
  }

  return (
    <EditorContext value={context}>
      <EditorLabelsContext value={labels}>
        <div className={editorFrame()} data-slot="editor">
          <EditorToolbar />
          <EditorContent className={editorScroll()} editor={editor} />
        </div>
      </EditorLabelsContext>
    </EditorContext>
  );
}
