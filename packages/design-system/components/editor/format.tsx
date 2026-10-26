import {
  HighlighterIcon,
  SourceCodeIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@hugeicons/core-free-icons";
import { RichEditorLink } from "@repo/design-system/components/editor/link";
import { EditorToggles } from "@repo/design-system/components/editor/tools";
import { useCurrentEditor, useEditorState } from "@tiptap/react";

/**
 * The marks of a text, in one group of toggles: bold, italic, underlined, struck, code and
 * highlighted words; and the link beside them, which opens its own field.
 */
export function RichEditorMarks({
  labels,
}: {
  labels: {
    bold: string;
    code: string;
    highlight: string;
    italic: string;
    link: string;
    linkPlaceholder: string;
    strike: string;
    underline: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      code: current?.isActive("code") ?? false,
      highlight: current?.isActive("highlight") ?? false,
      italic: current?.isActive("italic") ?? false,
      link: current?.isActive("link") ?? false,
      strike: current?.isActive("strike") ?? false,
      underline: current?.isActive("underline") ?? false,
    }),
  });

  return (
    <>
      <EditorToggles
        tools={[
          {
            active: state?.bold ?? false,
            icon: TextBoldIcon,
            label: labels.bold,
            name: "bold",
            run: () => editor?.chain().focus().toggleBold().run(),
          },
          {
            active: state?.italic ?? false,
            icon: TextItalicIcon,
            label: labels.italic,
            name: "italic",
            run: () => editor?.chain().focus().toggleItalic().run(),
          },
          {
            active: state?.underline ?? false,
            icon: TextUnderlineIcon,
            label: labels.underline,
            name: "underline",
            run: () => editor?.chain().focus().toggleUnderline().run(),
          },
          {
            active: state?.strike ?? false,
            icon: TextStrikethroughIcon,
            label: labels.strike,
            name: "strike",
            run: () => editor?.chain().focus().toggleStrike().run(),
          },
          {
            active: state?.code ?? false,
            icon: SourceCodeIcon,
            label: labels.code,
            name: "code",
            run: () => editor?.chain().focus().toggleCode().run(),
          },
          {
            active: state?.highlight ?? false,
            icon: HighlighterIcon,
            label: labels.highlight,
            name: "highlight",
            run: () => editor?.chain().focus().toggleHighlight().run(),
          },
        ]}
      />
      <RichEditorLink
        active={state?.link ?? false}
        label={labels.link}
        placeholder={labels.linkPlaceholder}
      />
    </>
  );
}

/**
 * The marks of an assessment document, in one group of toggles: bold, italic, underlined and
 * code words, subscript and superscript; and the link beside them. Strike and highlight are not
 * marks of the contract, so no control offers them.
 */
export function DocumentMarks({
  labels,
}: {
  labels: {
    bold: string;
    code: string;
    italic: string;
    link: string;
    linkPlaceholder: string;
    subscript: string;
    superscript: string;
    underline: string;
  };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      code: current?.isActive("code") ?? false,
      italic: current?.isActive("italic") ?? false,
      link: current?.isActive("link") ?? false,
      subscript: current?.isActive("subscript") ?? false,
      superscript: current?.isActive("superscript") ?? false,
      underline: current?.isActive("underline") ?? false,
    }),
  });

  return (
    <>
      <EditorToggles
        tools={[
          {
            active: state?.bold ?? false,
            icon: TextBoldIcon,
            label: labels.bold,
            name: "bold",
            run: () => editor?.chain().focus().toggleBold().run(),
          },
          {
            active: state?.italic ?? false,
            icon: TextItalicIcon,
            label: labels.italic,
            name: "italic",
            run: () => editor?.chain().focus().toggleItalic().run(),
          },
          {
            active: state?.underline ?? false,
            icon: TextUnderlineIcon,
            label: labels.underline,
            name: "underline",
            run: () => editor?.chain().focus().toggleUnderline().run(),
          },
          {
            active: state?.code ?? false,
            icon: SourceCodeIcon,
            label: labels.code,
            name: "code",
            run: () => editor?.chain().focus().toggleCode().run(),
          },
          {
            active: state?.subscript ?? false,
            icon: SubscriptIcon,
            label: labels.subscript,
            name: "subscript",
            run: () => editor?.chain().focus().toggleMark("subscript").run(),
          },
          {
            active: state?.superscript ?? false,
            icon: SuperscriptIcon,
            label: labels.superscript,
            name: "superscript",
            run: () => editor?.chain().focus().toggleMark("superscript").run(),
          },
        ]}
      />
      <RichEditorLink
        active={state?.link ?? false}
        label={labels.link}
        placeholder={labels.linkPlaceholder}
      />
    </>
  );
}
