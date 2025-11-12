"use client";

// --- Icons ---
import { BanIcon } from "@repo/design-system/components/tiptap-icons/ban-icon";
import { HighlighterIcon } from "@repo/design-system/components/tiptap-icons/highlighter-icon";
// --- Tiptap UI ---
import type {
  HighlightColor,
  UseColorHighlightConfig,
} from "@repo/design-system/components/tiptap-ui/color-highlight-button";
import {
  ColorHighlightButton,
  pickHighlightColorsByValue,
  useColorHighlight,
} from "@repo/design-system/components/tiptap-ui/color-highlight-button";
// --- UI Primitives ---
import type { ButtonProps } from "@repo/design-system/components/tiptap-ui-primitive/button";
import {
  Button,
  ButtonGroup,
} from "@repo/design-system/components/tiptap-ui-primitive/button";
import {
  Card,
  CardBody,
  CardItemGroup,
} from "@repo/design-system/components/tiptap-ui-primitive/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/tiptap-ui-primitive/popover";
import { Separator } from "@repo/design-system/components/tiptap-ui-primitive/separator";
import { useIsBreakpoint } from "@repo/design-system/hooks/use-is-breakpoint";
// --- Hooks ---
import { useMenuNavigation } from "@repo/design-system/hooks/use-menu-navigation";
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
import type { Editor } from "@tiptap/react";
import type React from "react";
import { useMemo, useRef, useState } from "react";

export type ColorHighlightPopoverContentProps = {
  /**
   * The Tiptap editor instance.
   */
  editor?: Editor | null;
  /**
   * Optional colors to use in the highlight popover.
   * If not provided, defaults to a predefined set of colors.
   */
  colors?: HighlightColor[];
};

export interface ColorHighlightPopoverProps
  extends Omit<ButtonProps, "type">,
    Pick<
      UseColorHighlightConfig,
      "editor" | "hideWhenUnavailable" | "onAppliedAction"
    > {
  /**
   * Optional colors to use in the highlight popover.
   * If not provided, defaults to a predefined set of colors.
   */
  colors?: HighlightColor[];
}

export const ColorHighlightPopoverButton = ({
  className,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => (
  <Button
    aria-label="Highlight text"
    className={className}
    data-appearance="default"
    data-style="ghost"
    ref={ref}
    role="button"
    tabIndex={-1}
    tooltip="Highlight"
    type="button"
    {...props}
  >
    {children ?? <HighlighterIcon className="tiptap-button-icon" />}
  </Button>
);

export function ColorHighlightPopoverContent({
  editor,
  colors = pickHighlightColorsByValue([
    "var(--tt-color-highlight-green)",
    "var(--tt-color-highlight-blue)",
    "var(--tt-color-highlight-red)",
    "var(--tt-color-highlight-purple)",
    "var(--tt-color-highlight-yellow)",
  ]),
}: ColorHighlightPopoverContentProps) {
  const { handleRemoveHighlight } = useColorHighlight({ editor });
  const isMobile = useIsBreakpoint();
  const containerRef = useRef<HTMLDivElement>(null);

  const menuItems = useMemo(
    () => [...colors, { label: "Remove highlight", value: "none" }],
    [colors]
  );

  const { selectedIndex } = useMenuNavigation({
    containerRef,
    items: menuItems,
    orientation: "both",
    onSelect: (item) => {
      if (!containerRef.current) {
        return false;
      }
      const highlightedElement = containerRef.current.querySelector(
        '[data-highlighted="true"]'
      ) as HTMLElement;
      if (highlightedElement) {
        highlightedElement.click();
      }
      if (item.value === "none") {
        handleRemoveHighlight();
      }
      return true;
    },
    autoSelectFirstItem: false,
  });

  return (
    <Card
      ref={containerRef}
      style={isMobile ? { boxShadow: "none", border: 0 } : {}}
      tabIndex={0}
    >
      <CardBody style={isMobile ? { padding: 0 } : {}}>
        <CardItemGroup orientation="horizontal">
          <ButtonGroup orientation="horizontal">
            {colors.map((color, index) => (
              <ColorHighlightButton
                aria-label={`${color.label} highlight color`}
                data-highlighted={selectedIndex === index}
                editor={editor}
                highlightColor={color.value}
                key={color.value}
                tabIndex={index === selectedIndex ? 0 : -1}
                tooltip={color.label}
              />
            ))}
          </ButtonGroup>
          <Separator />
          <ButtonGroup orientation="horizontal">
            <Button
              aria-label="Remove highlight"
              data-highlighted={selectedIndex === colors.length}
              data-style="ghost"
              onClick={handleRemoveHighlight}
              role="menuitem"
              tabIndex={selectedIndex === colors.length ? 0 : -1}
              tooltip="Remove highlight"
              type="button"
            >
              <BanIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>
        </CardItemGroup>
      </CardBody>
    </Card>
  );
}

export function ColorHighlightPopover({
  editor: providedEditor,
  colors = pickHighlightColorsByValue([
    "var(--tt-color-highlight-green)",
    "var(--tt-color-highlight-blue)",
    "var(--tt-color-highlight-red)",
    "var(--tt-color-highlight-purple)",
    "var(--tt-color-highlight-yellow)",
  ]),
  hideWhenUnavailable = false,
  onAppliedAction,
  ...props
}: ColorHighlightPopoverProps) {
  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = useState(false);
  const { isVisible, canColorHighlight, isActive, label, Icon } =
    useColorHighlight({
      editor,
      hideWhenUnavailable,
      onAppliedAction,
    });

  if (!isVisible) {
    return null;
  }

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger
        render={
          <ColorHighlightPopoverButton
            aria-label={label}
            aria-pressed={isActive}
            data-active-state={isActive ? "on" : "off"}
            data-disabled={!canColorHighlight}
            disabled={!canColorHighlight}
            tooltip={label}
            {...props}
          >
            <Icon className="tiptap-button-icon" />
          </ColorHighlightPopoverButton>
        }
      />
      <PopoverContent aria-label="Highlight colors">
        <ColorHighlightPopoverContent colors={colors} editor={editor} />
      </PopoverContent>
    </Popover>
  );
}

export default ColorHighlightPopover;
