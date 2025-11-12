"use client";

// --- Icons ---
import { HighlighterIcon } from "@repo/design-system/components/tiptap-icons/highlighter-icon";
import { useIsBreakpoint } from "@repo/design-system/hooks/use-is-breakpoint";
// --- Hooks ---
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
// --- Lib ---
import {
  isExtensionAvailable,
  isMarkInSchema,
  isNodeTypeSelected,
} from "@repo/design-system/lib/tiptap-utils";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export const COLOR_HIGHLIGHT_SHORTCUT_KEY = "mod+shift+h";
export const HIGHLIGHT_COLORS = [
  {
    label: "Default background",
    value: "var(--tt-bg-color)",
    border: "var(--tt-bg-color-contrast)",
  },
  {
    label: "Gray background",
    value: "var(--tt-color-highlight-gray)",
    border: "var(--tt-color-highlight-gray-contrast)",
  },
  {
    label: "Brown background",
    value: "var(--tt-color-highlight-brown)",
    border: "var(--tt-color-highlight-brown-contrast)",
  },
  {
    label: "Orange background",
    value: "var(--tt-color-highlight-orange)",
    border: "var(--tt-color-highlight-orange-contrast)",
  },
  {
    label: "Yellow background",
    value: "var(--tt-color-highlight-yellow)",
    border: "var(--tt-color-highlight-yellow-contrast)",
  },
  {
    label: "Green background",
    value: "var(--tt-color-highlight-green)",
    border: "var(--tt-color-highlight-green-contrast)",
  },
  {
    label: "Blue background",
    value: "var(--tt-color-highlight-blue)",
    border: "var(--tt-color-highlight-blue-contrast)",
  },
  {
    label: "Purple background",
    value: "var(--tt-color-highlight-purple)",
    border: "var(--tt-color-highlight-purple-contrast)",
  },
  {
    label: "Pink background",
    value: "var(--tt-color-highlight-pink)",
    border: "var(--tt-color-highlight-pink-contrast)",
  },
  {
    label: "Red background",
    value: "var(--tt-color-highlight-red)",
    border: "var(--tt-color-highlight-red-contrast)",
  },
];
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export type HighlightMode = "mark" | "node";

/**
 * Configuration for the color highlight functionality
 */
export type UseColorHighlightConfig = {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null;
  /**
   * The color to apply when toggling the highlight.
   */
  highlightColor?: string;
  /**
   * Optional label to display alongside the icon.
   */
  label?: string;
  /**
   * Whether the button should hide when the mark is not available.
   * @default false
   */
  hideWhenUnavailable?: boolean;
  /**
   * The highlighting mode to use.
   * - "mark": Uses the highlight mark extension (default)
   * - "node": Uses the node background extension
   * @default "mark"
   */
  mode?: HighlightMode;
  /**
   * Called when the highlight is applied.
   */
  onAppliedAction?: ({
    color,
    label,
    mode,
  }: {
    color: string;
    label: string;
    mode: HighlightMode;
  }) => void;
};

export function pickHighlightColorsByValue(values: string[]) {
  const colorMap = new Map(
    HIGHLIGHT_COLORS.map((color) => [color.value, color])
  );
  return values
    .map((value) => colorMap.get(value))
    .filter((color): color is (typeof HIGHLIGHT_COLORS)[number] => !!color);
}

/**
 * Checks if highlight can be applied based on the mode and current editor state
 */
export function canColorHighlight(
  editor: Editor | null,
  mode: HighlightMode = "mark"
): boolean {
  if (!editor?.isEditable) {
    return false;
  }

  if (mode === "mark") {
    if (
      !isMarkInSchema("highlight", editor) ||
      isNodeTypeSelected(editor, ["image"])
    ) {
      return false;
    }

    return editor.can().setMark("highlight");
  }
  if (!isExtensionAvailable(editor, ["nodeBackground"])) {
    return false;
  }

  try {
    return editor.can().toggleNodeBackgroundColor("test");
  } catch {
    return false;
  }
}

/**
 * Checks if highlight is currently active
 */
export function isColorHighlightActive(
  editor: Editor | null,
  highlightColor?: string,
  mode: HighlightMode = "mark"
): boolean {
  if (!editor?.isEditable) {
    return false;
  }

  if (mode === "mark") {
    return highlightColor
      ? editor.isActive("highlight", { color: highlightColor })
      : editor.isActive("highlight");
  }
  if (!highlightColor) {
    return false;
  }

  try {
    const { state } = editor;
    const { selection } = state;

    const $pos = selection.$anchor;
    for (let depth = $pos.depth; depth >= 0; depth--) {
      const node = $pos.node(depth);
      if (node && node.attrs?.backgroundColor === highlightColor) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Removes highlight based on the mode
 */
export function removeHighlight(
  editor: Editor | null,
  mode: HighlightMode = "mark"
): boolean {
  if (!editor?.isEditable) {
    return false;
  }
  if (!canColorHighlight(editor, mode)) {
    return false;
  }

  if (mode === "mark") {
    return editor.chain().focus().unsetMark("highlight").run();
  }
  return editor.chain().focus().unsetNodeBackgroundColor().run();
}

/**
 * Determines if the highlight button should be shown
 */
export function shouldShowButton(props: {
  editor: Editor | null;
  hideWhenUnavailable: boolean;
  mode: HighlightMode;
}): boolean {
  const { editor, hideWhenUnavailable, mode } = props;

  if (!editor?.isEditable) {
    return false;
  }

  if (mode === "mark") {
    if (!isMarkInSchema("highlight", editor)) {
      return false;
    }
  } else if (!isExtensionAvailable(editor, ["nodeBackground"])) {
    return false;
  }

  if (hideWhenUnavailable && !editor.isActive("code")) {
    return canColorHighlight(editor, mode);
  }

  return true;
}

export function useColorHighlight(config: UseColorHighlightConfig) {
  const {
    editor: providedEditor,
    label,
    highlightColor,
    hideWhenUnavailable = false,
    mode = "mark",
    onAppliedAction,
  } = config;

  const { editor } = useTiptapEditor(providedEditor);
  const isMobile = useIsBreakpoint();
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const canColorHighlightState = canColorHighlight(editor, mode);
  const isActive = isColorHighlightActive(editor, highlightColor, mode);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleSelectionUpdate = () => {
      setIsVisible(shouldShowButton({ editor, hideWhenUnavailable, mode }));
    };

    handleSelectionUpdate();

    editor.on("selectionUpdate", handleSelectionUpdate);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, hideWhenUnavailable, mode]);

  const handleColorHighlight = useCallback(() => {
    if (!(editor && canColorHighlightState && highlightColor && label)) {
      return false;
    }

    if (mode === "mark") {
      if (editor.state.storedMarks) {
        const highlightMarkType = editor.schema.marks.highlight;
        if (highlightMarkType) {
          editor.view.dispatch(
            editor.state.tr.removeStoredMark(highlightMarkType)
          );
        }
      }

      setTimeout(() => {
        const success = editor
          .chain()
          .focus()
          .toggleMark("highlight", { color: highlightColor })
          .run();
        if (success) {
          onAppliedAction?.({ color: highlightColor, label, mode });
        }
        return success;
      }, 0);

      return true;
    }
    const success = editor
      .chain()
      .focus()
      .toggleNodeBackgroundColor(highlightColor)
      .run();

    if (success) {
      onAppliedAction?.({ color: highlightColor, label, mode });
    }
    return success;
  }, [
    canColorHighlightState,
    highlightColor,
    editor,
    label,
    onAppliedAction,
    mode,
  ]);

  const handleRemoveHighlight = useCallback(() => {
    const success = removeHighlight(editor, mode);
    if (success) {
      onAppliedAction?.({ color: "", label: "Remove highlight", mode });
    }
    return success;
  }, [editor, onAppliedAction, mode]);

  useHotkeys(
    COLOR_HIGHLIGHT_SHORTCUT_KEY,
    (event) => {
      event.preventDefault();
      handleColorHighlight();
    },
    {
      enabled: isVisible && canColorHighlightState,
      enableOnContentEditable: !isMobile,
      enableOnFormTags: true,
    }
  );

  return {
    isVisible,
    isActive,
    handleColorHighlight,
    handleRemoveHighlight,
    canColorHighlight: canColorHighlightState,
    label: label || "Highlight",
    shortcutKeys: COLOR_HIGHLIGHT_SHORTCUT_KEY,
    Icon: HighlighterIcon,
    mode,
  };
}
