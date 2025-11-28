"use client";

// --- Tiptap UI ---
import type {
  UndoRedoAction,
  UseUndoRedoConfig,
} from "@repo/design-system/components/tiptap-ui/undo-redo-button";
import {
  UNDO_REDO_SHORTCUT_KEYS,
  useUndoRedo,
} from "@repo/design-system/components/tiptap-ui/undo-redo-button";
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

export interface UndoRedoButtonProps
  extends Omit<ButtonProps, "type">,
    UseUndoRedoConfig {
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

export function HistoryShortcutBadge({
  action,
  shortcutKeys = UNDO_REDO_SHORTCUT_KEYS[action],
}: {
  action: UndoRedoAction;
  shortcutKeys?: string;
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>;
}

/**
 * Button component for triggering undo/redo actions in a Tiptap editor.
 *
 * For custom button implementations, use the `useHistory` hook instead.
 */
export const UndoRedoButton = ({
  editor: providedEditor,
  action,
  text,
  hideWhenUnavailable = false,
  onExecuted,
  showShortcut = false,
  onClick,
  children,
  ref,
  ...buttonProps
}: UndoRedoButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const { isVisible, handleAction, label, canExecute, Icon, shortcutKeys } =
    useUndoRedo({
      editor,
      action,
      hideWhenUnavailable,
      onExecuted,
    });

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      handleAction();
    },
    [handleAction, onClick]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      aria-label={label}
      data-disabled={!canExecute}
      data-style="ghost"
      disabled={!canExecute}
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
            <HistoryShortcutBadge action={action} shortcutKeys={shortcutKeys} />
          )}
        </>
      )}
    </Button>
  );
};
