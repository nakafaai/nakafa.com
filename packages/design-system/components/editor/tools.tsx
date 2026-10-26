import {
  ArrowDown01Icon,
  Redo02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { ToolHint } from "@repo/design-system/components/editor/tip";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import { useCurrentEditor, useEditorState } from "@tiptap/react";
import { Array as Arr, Option } from "effect";
import type { ComponentProps } from "react";

/** One control of the toolbar, named in its tooltip. It shows as pressed while the caret sits in its format. */
export function RichEditorControl({
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
 * Formats that a writer turns on and off, such as the marks, as one group of toggles: each is
 * named in its tooltip and pressed while the caret sits in its format, and the arrow keys move
 * between them. A press keeps the focus in the text.
 */
export function EditorToggles({ tools }: { tools: readonly EditorTool[] }) {
  return (
    <ToggleGroup
      size="sm"
      type="multiple"
      value={Arr.map(
        Arr.filter(tools, (tool) => tool.active === true),
        (tool) => tool.name
      )}
    >
      {Arr.map(tools, (tool) => (
        <ToolHint key={tool.name} label={tool.label}>
          <ToggleGroupItem
            aria-label={tool.label}
            className="flex-none"
            onClick={tool.run}
            // The press must not take the focus from the text, or the caret and the
            // next keystrokes would be lost for a moment.
            onMouseDown={(event) => event.preventDefault()}
            value={tool.name}
          >
            <HugeIcons icon={tool.icon} />
          </ToggleGroupItem>
        </ToolHint>
      ))}
    </ToggleGroup>
  );
}

/**
 * Controls a writer needs less often, behind one button named `label`: it shows the icon of the
 * format the caret sits in, or `icon`, and opens a menu of the controls with their names. A
 * format shows its check in the menu. After a pick with the pointer the caret goes back to the
 * text, and the menu closes.
 */
export function EditorMenu({
  icon,
  label,
  tools,
}: {
  icon: ComponentProps<typeof HugeIcons>["icon"];
  label: string;
  tools: readonly EditorTool[];
}) {
  const { editor } = useCurrentEditor();
  const shown = Option.getOrElse(
    Option.map(
      Arr.findFirst(tools, (tool) => tool.active === true),
      (tool) => tool.icon
    ),
    () => icon
  );

  return (
    <DropdownMenu>
      <ToolHint label={label}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={label}
              className="gap-0.5 has-[>svg]:px-1.5"
              size="sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <HugeIcons icon={shown} />
          <HugeIcons
            className="size-3 text-muted-foreground"
            icon={ArrowDown01Icon}
          />
        </DropdownMenuTrigger>
      </ToolHint>
      <DropdownMenuContent
        className="w-48"
        finalFocus={(closed) =>
          closed === "keyboard" ? true : (editor?.view.dom ?? true)
        }
      >
        {Arr.map(tools, (tool) =>
          tool.active === undefined ? (
            <DropdownMenuItem key={tool.name} onClick={tool.run}>
              <HugeIcons icon={tool.icon} />
              {tool.label}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuCheckboxItem
              checked={tool.active}
              closeOnClick
              key={tool.name}
              onCheckedChange={tool.run}
            >
              <HugeIcons icon={tool.icon} />
              {tool.label}
            </DropdownMenuCheckboxItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
