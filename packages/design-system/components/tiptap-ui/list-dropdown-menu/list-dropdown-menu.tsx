"use client";

// --- Icons ---
import { ChevronDownIcon } from "@repo/design-system/components/tiptap-icons/chevron-down-icon";
// --- Tiptap UI ---
import {
  ListButton,
  type ListType,
} from "@repo/design-system/components/tiptap-ui/list-button";
import { useListDropdownMenu } from "@repo/design-system/components/tiptap-ui/list-dropdown-menu/use-list-dropdown-menu";
// --- UI Primitives ---
import type { ButtonProps } from "@repo/design-system/components/tiptap-ui-primitive/button";
import {
  Button,
  ButtonGroup,
} from "@repo/design-system/components/tiptap-ui-primitive/button";
import {
  Card,
  CardBody,
} from "@repo/design-system/components/tiptap-ui-primitive/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/tiptap-ui-primitive/dropdown-menu";
// --- Hooks ---
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
import type { Editor } from "@tiptap/react";
import { useCallback, useState } from "react";

export interface ListDropdownMenuProps extends Omit<ButtonProps, "type"> {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor;
  /**
   * The list types to display in the dropdown.
   */
  types?: ListType[];
  /**
   * Whether the dropdown should be hidden when no list types are available
   * @default false
   */
  hideWhenUnavailable?: boolean;
  /**
   * Callback for when the dropdown opens or closes
   */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Whether to render the dropdown menu in a portal
   * @default false
   */
  portal?: boolean;
}

export function ListDropdownMenu({
  editor: providedEditor,
  types = ["bulletList", "orderedList", "taskList"],
  hideWhenUnavailable = false,
  onOpenChange,
  portal = false,
  ...props
}: ListDropdownMenuProps) {
  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = useState(false);

  const { filteredLists, canToggle, isActive, isVisible, Icon } =
    useListDropdownMenu({
      editor,
      types,
      hideWhenUnavailable,
    });

  const handleOnOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange]
  );

  if (!(isVisible && editor && editor.isEditable)) {
    return null;
  }

  return (
    <DropdownMenu onOpenChange={handleOnOpenChange} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="List options"
          data-active-state={isActive ? "on" : "off"}
          data-disabled={!canToggle}
          data-style="ghost"
          disabled={!canToggle}
          role="button"
          tabIndex={-1}
          tooltip="List"
          type="button"
          {...props}
        >
          <Icon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" portal={portal}>
        <Card>
          <CardBody>
            <ButtonGroup>
              {filteredLists.map((option) => (
                <DropdownMenuItem asChild key={option.type}>
                  <ListButton
                    editor={editor}
                    showTooltip={false}
                    text={option.label}
                    type={option.type}
                  />
                </DropdownMenuItem>
              ))}
            </ButtonGroup>
          </CardBody>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ListDropdownMenu;
