"use client";

// --- Tiptap UI ---
import type {
  Level,
  UseHeadingConfig,
} from "@repo/design-system/components/tiptap-ui/heading-button";
import {
  HEADING_SHORTCUT_KEYS,
  useHeading,
} from "@repo/design-system/components/tiptap-ui/heading-button";
import { Badge } from "@repo/design-system/components/tiptap-ui-primitive/badge";
// --- UI Primitives ---
import type { ButtonProps } from "@repo/design-system/components/tiptap-ui-primitive/button";
import { Button } from "@repo/design-system/components/tiptap-ui-primitive/button";
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
// --- Lib ---
import { parseShortcutKeys } from "@repo/design-system/lib/tiptap-utils";
import type React from "react";
import { useCallback } from "react";

export interface HeadingButtonProps
  extends Omit<ButtonProps, "type">,
    UseHeadingConfig {
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

export function HeadingShortcutBadge({
  level,
  shortcutKeys = HEADING_SHORTCUT_KEYS[level],
}: {
  level: Level;
  shortcutKeys?: string;
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>;
}

/**
 * Button component for toggling heading in a Tiptap editor.
 *
 * For custom button implementations, use the `useHeading` hook instead.
 */
export const HeadingButton = ({
  editor: providedEditor,
  level,
  text,
  hideWhenUnavailable = false,
  onToggled,
  showShortcut = false,
  onClick,
  children,
  ref,
  ...buttonProps
}: HeadingButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const {
    isVisible,
    canToggle,
    isActive,
    handleToggle,
    label,
    Icon,
    shortcutKeys,
  } = useHeading({
    editor,
    level,
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
            <HeadingShortcutBadge level={level} shortcutKeys={shortcutKeys} />
          )}
        </>
      )}
    </Button>
  );
};
