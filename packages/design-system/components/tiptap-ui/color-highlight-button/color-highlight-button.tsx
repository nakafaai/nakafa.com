"use client";

// --- Tiptap UI ---
import type { UseColorHighlightConfig } from "@repo/design-system/components/tiptap-ui/color-highlight-button";
import {
  COLOR_HIGHLIGHT_SHORTCUT_KEY,
  useColorHighlight,
} from "@repo/design-system/components/tiptap-ui/color-highlight-button";
import { Badge } from "@repo/design-system/components/tiptap-ui-primitive/badge";
// --- UI Primitives ---
import type { ButtonProps } from "@repo/design-system/components/tiptap-ui-primitive/button";
import { Button } from "@repo/design-system/components/tiptap-ui-primitive/button";
// --- Hooks ---
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
// --- Lib ---
import { parseShortcutKeys } from "@repo/design-system/lib/tiptap-utils";
import type React from "react";
import { useCallback, useMemo } from "react";

// --- Styles ---
import "@repo/design-system/components/tiptap-ui/color-highlight-button/color-highlight-button.scss";

export interface ColorHighlightButtonProps
  extends Omit<ButtonProps, "type">,
    UseColorHighlightConfig {
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

export function ColorHighlightShortcutBadge({
  shortcutKeys = COLOR_HIGHLIGHT_SHORTCUT_KEY,
}: {
  shortcutKeys?: string;
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>;
}

/**
 * Button component for applying color highlights in a Tiptap editor.
 *
 * Supports two highlighting modes:
 * - "mark": Uses the highlight mark extension (default)
 * - "node": Uses the node background extension
 *
 * For custom button implementations, use the `useColorHighlight` hook instead.
 *
 * @example
 * ```tsx
 * // Mark-based highlighting (default)
 * <ColorHighlightButton highlightColor="yellow" />
 *
 * // Node-based background coloring
 * <ColorHighlightButton
 *   highlightColor="var(--tt-color-highlight-blue)"
 *   mode="node"
 * />
 *
 * // With custom callback
 * <ColorHighlightButton
 *   highlightColor="red"
 *   mode="mark"
 *   onAppliedAction={({ color, mode }) => console.log(`Applied ${color} in ${mode} mode`)}
 * />
 * ```
 */
export const ColorHighlightButton = ({
  editor: providedEditor,
  highlightColor,
  text,
  hideWhenUnavailable = false,
  mode = "mark",
  onAppliedAction,
  showShortcut = false,
  onClick,
  children,
  style,
  ref,
  ...buttonProps
}: ColorHighlightButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const {
    isVisible,
    canColorHighlight,
    isActive,
    handleColorHighlight,
    label,
    shortcutKeys,
  } = useColorHighlight({
    editor,
    highlightColor,
    label: text || `Toggle highlight (${highlightColor})`,
    hideWhenUnavailable,
    mode,
    onAppliedAction,
  });

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      handleColorHighlight();
    },
    [handleColorHighlight, onClick]
  );

  const buttonStyle = useMemo(
    () =>
      ({
        ...style,
        "--highlight-color": highlightColor,
      }) as React.CSSProperties,
    [highlightColor, style]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <Button
      aria-label={label}
      aria-pressed={isActive}
      data-active-state={isActive ? "on" : "off"}
      data-disabled={!canColorHighlight}
      data-style="ghost"
      disabled={!canColorHighlight}
      onClick={handleClick}
      role="button"
      style={buttonStyle}
      tabIndex={-1}
      tooltip={label}
      type="button"
      {...buttonProps}
      ref={ref}
    >
      {children ?? (
        <>
          <span
            className="tiptap-button-highlight"
            style={
              { "--highlight-color": highlightColor } as React.CSSProperties
            }
          />
          {!!text && <span className="tiptap-button-text">{text}</span>}
          {!!showShortcut && (
            <ColorHighlightShortcutBadge shortcutKeys={shortcutKeys} />
          )}
        </>
      )}
    </Button>
  );
};
