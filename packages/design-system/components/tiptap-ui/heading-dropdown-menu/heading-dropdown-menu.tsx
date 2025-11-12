"use client";

// --- Icons ---
import { ChevronDownIcon } from "@repo/design-system/components/tiptap-icons/chevron-down-icon";
// --- Tiptap UI ---
import { HeadingButton } from "@repo/design-system/components/tiptap-ui/heading-button";
import type { UseHeadingDropdownMenuConfig } from "@repo/design-system/components/tiptap-ui/heading-dropdown-menu";
import { useHeadingDropdownMenu } from "@repo/design-system/components/tiptap-ui/heading-dropdown-menu";
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
import type React from "react";
import { useCallback, useState } from "react";

export interface HeadingDropdownMenuProps
  extends Omit<ButtonProps, "type">,
    UseHeadingDropdownMenuConfig {
  /**
   * Whether to render the dropdown menu in a portal
   * @default false
   */
  portal?: boolean;
  /**
   * Callback for when the dropdown opens or closes
   */
  onOpenChange?: (isOpen: boolean) => void;
}

/**
 * Dropdown menu component for selecting heading levels in a Tiptap editor.
 *
 * For custom dropdown implementations, use the `useHeadingDropdownMenu` hook instead.
 */
export const HeadingDropdownMenu = ({
  editor: providedEditor,
  levels = [1, 2, 3, 4, 5, 6],
  hideWhenUnavailable = false,
  portal = false,
  onOpenChange,
  ref,
  ...buttonProps
}: HeadingDropdownMenuProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { isVisible, isActive, canToggle, Icon } = useHeadingDropdownMenu({
    editor,
    levels,
    hideWhenUnavailable,
  });

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!(editor && canToggle)) {
        return;
      }
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [canToggle, editor, onOpenChange]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <DropdownMenu modal onOpenChange={handleOpenChange} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Format text as heading"
          aria-pressed={isActive}
          data-active-state={isActive ? "on" : "off"}
          data-disabled={!canToggle}
          data-style="ghost"
          disabled={!canToggle}
          role="button"
          tabIndex={-1}
          tooltip="Heading"
          type="button"
          {...buttonProps}
          ref={ref}
        >
          <Icon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" portal={portal}>
        <Card>
          <CardBody>
            <ButtonGroup>
              {levels.map((level) => (
                <DropdownMenuItem asChild key={`heading-${level}`}>
                  <HeadingButton
                    editor={editor}
                    level={level}
                    showTooltip={false}
                    text={`Heading ${level}`}
                  />
                </DropdownMenuItem>
              ))}
            </ButtonGroup>
          </CardBody>
        </Card>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HeadingDropdownMenu;
