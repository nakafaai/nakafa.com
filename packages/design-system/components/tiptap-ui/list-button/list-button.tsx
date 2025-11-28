"use client";

// --- Tiptap UI ---
import type {
  ListType,
  UseListConfig,
} from "@repo/design-system/components/tiptap-ui/list-button";
import {
  LIST_SHORTCUT_KEYS,
  useList,
} from "@repo/design-system/components/tiptap-ui/list-button";
import { Badge } from "@repo/design-system/components/tiptap-ui-primitive/badge";

// --- UI Primitives ---
import type { ButtonProps } from "@repo/design-system/components/tiptap-ui-primitive/button";
import { Button } from "@repo/design-system/components/tiptap-ui-primitive/button";
// --- Hooks ---
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
// --- Lib ---
import { parseShortcutKeys } from "@repo/design-system/lib/tiptap-utils";
import type React from "react";
import { useCallback } from "react";

export interface ListButtonProps
  extends Omit<ButtonProps, "type">,
    UseListConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string;
  /**
   * Optional show shortcut keys in the button.
   * @default false
   */
  showShortcut?: boolean;
}

export function ListShortcutBadge({
  type,
  shortcutKeys = LIST_SHORTCUT_KEYS[type],
}: {
  type: ListType;
  shortcutKeys?: string;
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>;
}

/**
 * Button component for toggling lists in a Tiptap editor.
 *
 * For custom button implementations, use the `useList` hook instead.
 */
export const ListButton = ({
  editor: providedEditor,
  type,
  text,
  hideWhenUnavailable = false,
  onToggled,
  showShortcut = false,
  onClick,
  children,
  ref,
  ...buttonProps
}: ListButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const {
    isVisible,
    canToggle,
    isActive,
    handleToggle,
    label,
    shortcutKeys,
    Icon,
  } = useList({
    editor,
    type,
    hideWhenUnavailable,
    onToggled,
  });

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      handleToggle();
    },
    [handleToggle, onClick]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      aria-label={label}
      aria-pressed={isActive}
      data-active-state={isActive ? "on" : "off"}
      data-disabled={!canToggle}
      data-style="ghost"
      disabled={!canToggle}
      onClick={handleClick}
      role="button"
      tabIndex={-1}
      tooltip={label}
      type="button"
      {...buttonProps}
      ref={ref}
    >
      {children ?? (
        <>
          <Icon className="tiptap-button-icon" />
          {!!text && <span className="tiptap-button-text">{text}</span>}
          {!!showShortcut && (
            <ListShortcutBadge shortcutKeys={shortcutKeys} type={type} />
          )}
        </>
      )}
    </Button>
  );
};
