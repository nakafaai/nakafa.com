import { Redo02Icon, Undo02Icon } from "@hugeicons/core-free-icons";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";

/**
 * One control of the toolbar, named in its tooltip. A format's control is pressed while the caret sits in its format;
 * an action's control, without `active`, is a plain button.
 */
export function RichEditorControl({
  active,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  active?: boolean | undefined;
  disabled?: boolean;
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  onClick: () => void;
}) {
  return (
    <ToolHint label={label}>
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
        type="button"
        variant="ghost"
      >
        <HugeIcons icon={icon} />
      </Button>
    </ToolHint>
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

/**
 * One control of a toolbar group or menu: its icon, the name a writer hears and sees, the key
 * it goes by, what it does, and, for a format, whether the caret sits in it. A control without
 * `active` acts once, such as a divider that is inserted.
 */
interface EditorTool {
  readonly active?: boolean;
  readonly icon: ComponentProps<typeof HugeIcons>["icon"];
  readonly label: string;
  readonly name: string;
  readonly run: () => void;
}

/**
 * The controls of one toolbar group, each its own rounded button named in its tooltip: a format that a writer turns
 * on and off, such as a mark, a list or a quote, shows as pressed while the caret sits in it, and an action, such as
 * a formula or an image, acts once. Nothing hides behind a menu, so a writer sees every block the editor takes.
 */
export function EditorTools({ tools }: { tools: readonly EditorTool[] }) {
  return Arr.map(tools, (tool) => (
    <RichEditorControl
      active={tool.active}
      icon={tool.icon}
      key={tool.name}
      label={tool.label}
      onClick={tool.run}
    />
  ));
}
