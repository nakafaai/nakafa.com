"use client";

import {
  CheckListIcon,
  CodeSquareIcon,
  HighlighterIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  QuoteDownIcon,
  Redo02Icon,
  SourceCodeIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { RichEditorLink } from "@repo/design-system/components/editor/link";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import type { ComponentProps } from "react";

/** One control of the toolbar. It shows as pressed while the caret sits in its format. */
function RichEditorControl({
  active = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
      disabled={disabled}
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

/** Takes back the last edit, or makes it again. */
export function RichEditorHistory({
  labels,
}: {
  labels: { redo: string; undo: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      redo: current?.can().redo() ?? false,
      undo: current?.can().undo() ?? false,
    }),
  });

  return (
    <>
      <RichEditorControl
        disabled={!state?.undo}
        icon={Undo02Icon}
        label={labels.undo}
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <RichEditorControl
        disabled={!state?.redo}
        icon={Redo02Icon}
        label={labels.redo}
        onClick={() => editor?.chain().focus().redo().run()}
      />
    </>
  );
}

/** The marks a writer reaches for most: bold, italic, underlined and struck words, and links. */
export function RichEditorMarks({
  labels,
}: {
  labels: {
    bold: string;
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
      italic: current?.isActive("italic") ?? false,
      link: current?.isActive("link") ?? false,
      strike: current?.isActive("strike") ?? false,
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
        active={state?.strike ?? false}
        icon={TextStrikethroughIcon}
        label={labels.strike}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      />
      <RichEditorLink
        active={state?.link ?? false}
        label={labels.link}
        placeholder={labels.linkPlaceholder}
      />
    </>
  );
}

/** Bulleted, numbered and task lists. */
export function RichEditorLists({
  labels,
}: {
  labels: { bullets: string; numbers: string; tasks: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bullets: current?.isActive("bulletList") ?? false,
      numbers: current?.isActive("orderedList") ?? false,
      tasks: current?.isActive("taskList") ?? false,
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
        active={state?.tasks ?? false}
        icon={CheckListIcon}
        label={labels.tasks}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      />
    </>
  );
}

/** The marks a writer needs less often: code and highlighted words. */
export function RichEditorInline({
  labels,
}: {
  labels: { code: string; highlight: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      code: current?.isActive("code") ?? false,
      highlight: current?.isActive("highlight") ?? false,
    }),
  });

  return (
    <>
      <RichEditorControl
        active={state?.code ?? false}
        icon={SourceCodeIcon}
        label={labels.code}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      />
      <RichEditorControl
        active={state?.highlight ?? false}
        icon={HighlighterIcon}
        label={labels.highlight}
        onClick={() => editor?.chain().focus().toggleHighlight().run()}
      />
    </>
  );
}

/** Quotes, code blocks and dividers. */
export function RichEditorBlocks({
  labels,
}: {
  labels: { codeBlock: string; divider: string; quote: string };
}) {
  const { editor } = useCurrentEditor();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      codeBlock: current?.isActive("codeBlock") ?? false,
      quote: current?.isActive("blockquote") ?? false,
    }),
  });

  return (
    <>
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
      <RichEditorControl
        icon={MinusSignIcon}
        label={labels.divider}
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
      />
    </>
  );
}
