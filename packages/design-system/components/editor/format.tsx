import {
  SourceCodeIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
} from "@hugeicons/core-free-icons";
import { RichEditorLink } from "@repo/design-system/components/editor/link";
import { RichEditorControl } from "@repo/design-system/components/editor/tools";
import { useCurrentEditor, useEditorState } from "@tiptap/react";

/**
 * The marks of an assessment document that a writer reaches for: bold, italic, underlined
 * and code words, subscript and superscript, and links. Strike and highlight are not marks
 * of the contract, so no control offers them.
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
      <RichEditorControl
        active={state?.bold ?? false}
        icon={TextBoldIcon}
        label={labels.bold}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <RichEditorControl
        active={state?.italic ?? false}
        icon={TextItalicIcon}
        label={labels.italic}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <RichEditorControl
        active={state?.underline ?? false}
        icon={TextUnderlineIcon}
        label={labels.underline}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      />
      <RichEditorControl
        active={state?.code ?? false}
        icon={SourceCodeIcon}
        label={labels.code}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      />
      <RichEditorControl
        active={state?.subscript ?? false}
        icon={SubscriptIcon}
        label={labels.subscript}
        onClick={() => editor?.chain().focus().toggleMark("subscript").run()}
      />
      <RichEditorControl
        active={state?.superscript ?? false}
        icon={SuperscriptIcon}
        label={labels.superscript}
        onClick={() => editor?.chain().focus().toggleMark("superscript").run()}
      />
      <RichEditorLink
        active={state?.link ?? false}
        label={labels.link}
        placeholder={labels.linkPlaceholder}
      />
    </>
  );
}
