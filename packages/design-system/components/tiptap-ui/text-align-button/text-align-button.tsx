"use client";

// --- Tiptap UI ---
import type {
  TextAlign,
  UseTextAlignConfig,
} from "@repo/design-system/components/tiptap-ui/text-align-button";
import {
  TEXT_ALIGN_SHORTCUT_KEYS,
  useTextAlign,
} from "@repo/design-system/components/tiptap-ui/text-align-button";
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

interface IconProps extends React.SVGProps<SVGSVGElement> {}
type IconComponent = ({ className, ...props }: IconProps) => React.ReactElement;

export interface TextAlignButtonProps
  extends Omit<ButtonProps, "type">,
    UseTextAlignConfig {
  /**
   * Optional text to display alongside the icon.
   */
  text?: string;
  /**
   * Optional show shortcut keys in the button.
   * @default false
   */
  showShortcut?: boolean;
  /**
   * Optional custom icon component to render instead of the default.
   */
  icon?: React.MemoExoticComponent<IconComponent> | React.FC<IconProps>;
}

export function TextAlignShortcutBadge({
  align,
  shortcutKeys = TEXT_ALIGN_SHORTCUT_KEYS[align],
}: {
  align: TextAlign;
  shortcutKeys?: string;
}) {
  return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>;
}

/**
 * Button component for setting text alignment in a Tiptap editor.
 *
 * For custom button implementations, use the `useTextAlign` hook instead.
 */
export const TextAlignButton = ({
  editor: providedEditor,
  align,
  text,
  hideWhenUnavailable = false,
  onAligned,
  showShortcut = false,
  onClick,
  icon: CustomIcon,
  children,
  ref,
  ...buttonProps
}: TextAlignButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const {
    isVisible,
    handleTextAlign,
    label,
    canAlign,
    isActive,
    Icon,
    shortcutKeys,
  } = useTextAlign({
    editor,
    align,
    hideWhenUnavailable,
    onAligned,
  });

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      handleTextAlign();
    },
    [handleTextAlign, onClick]
  );

  if (!isVisible) {
    return null;
  }

  const RenderIcon = CustomIcon ?? Icon;

  return (
    <Button
      aria-label={label}
      aria-pressed={isActive}
      data-active-state={isActive ? "on" : "off"}
      data-disabled={!canAlign}
      data-style="ghost"
      disabled={!canAlign}
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
          <RenderIcon className="tiptap-button-icon" />
          {!!text && <span className="tiptap-button-text">{text}</span>}
          {!!showShortcut && (
            <TextAlignShortcutBadge align={align} shortcutKeys={shortcutKeys} />
          )}
        </>
      )}
    </Button>
  );
};
