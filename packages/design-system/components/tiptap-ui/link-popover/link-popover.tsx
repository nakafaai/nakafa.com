"use client";

// --- Icons ---
import { CornerDownLeftIcon } from "@repo/design-system/components/tiptap-icons/corner-down-left-icon";
import { ExternalLinkIcon } from "@repo/design-system/components/tiptap-icons/external-link-icon";
import { LinkIcon } from "@repo/design-system/components/tiptap-icons/link-icon";
import { TrashIcon } from "@repo/design-system/components/tiptap-icons/trash-icon";
// --- Tiptap UI ---
import type { UseLinkPopoverConfig } from "@repo/design-system/components/tiptap-ui/link-popover";
import { useLinkPopover } from "@repo/design-system/components/tiptap-ui/link-popover";
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
  Input,
  InputGroup,
} from "@repo/design-system/components/tiptap-ui-primitive/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/tiptap-ui-primitive/popover";
import { Separator } from "@repo/design-system/components/tiptap-ui-primitive/separator";
// --- Hooks ---
import { useIsBreakpoint } from "@repo/design-system/hooks/use-is-breakpoint";
import { useTiptapEditor } from "@repo/design-system/hooks/use-tiptap-editor";
import type { Editor } from "@tiptap/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

export interface LinkMainProps {
  /**
   * The URL to set for the link.
   */
  url: string;
  /**
   * Function to update the URL state.
   */
  setUrl: React.Dispatch<React.SetStateAction<string | null>>;
  /**
   * Function to set the link in the editor.
   */
  setLink: () => void;
  /**
   * Function to remove the link from the editor.
   */
  removeLink: () => void;
  /**
   * Function to open the link.
   */
  openLink: () => void;
  /**
   * Whether the link is currently active in the editor.
   */
  isActive: boolean;
}

export interface LinkPopoverProps
  extends Omit<ButtonProps, "type">,
    UseLinkPopoverConfig {
  /**
   * Callback for when the popover opens or closes.
   */
  onOpenChange?: (isOpen: boolean) => void;
  /**
   * Whether to automatically open the popover when a link is active.
   * @default true
   */
  autoOpenOnLinkActive?: boolean;
}

/**
 * Link button component for triggering the link popover
 */
export const LinkButton = ({
  className,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => (
  <Button
    aria-label="Link"
    className={className}
    data-style="ghost"
    ref={ref}
    role="button"
    tabIndex={-1}
    tooltip="Link"
    type="button"
    {...props}
  >
    {children || <LinkIcon className="tiptap-button-icon" />}
  </Button>
);

/**
 * Main content component for the link popover
 */
const LinkMain: React.FC<LinkMainProps> = ({
  url,
  setUrl,
  setLink,
  removeLink,
  openLink,
  isActive,
}) => {
  const isMobile = useIsBreakpoint();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setLink();
    }
  };

  return (
    <Card
      style={{
        ...(isMobile ? { boxShadow: "none", border: 0 } : {}),
      }}
    >
      <CardBody
        style={{
          ...(isMobile ? { padding: 0 } : {}),
        }}
      >
        <CardItemGroup orientation="horizontal">
          <InputGroup>
            <Input
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              autoFocus
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste a link..."
              type="url"
              value={url}
            />
          </InputGroup>

          <ButtonGroup orientation="horizontal">
            <Button
              data-style="ghost"
              disabled={!(url || isActive)}
              onClick={setLink}
              title="Apply link"
              type="button"
            >
              <CornerDownLeftIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>

          <Separator />

          <ButtonGroup orientation="horizontal">
            <Button
              data-style="ghost"
              disabled={!(url || isActive)}
              onClick={openLink}
              title="Open in new window"
              type="button"
            >
              <ExternalLinkIcon className="tiptap-button-icon" />
            </Button>

            <Button
              data-style="ghost"
              disabled={!(url || isActive)}
              onClick={removeLink}
              title="Remove link"
              type="button"
            >
              <TrashIcon className="tiptap-button-icon" />
            </Button>
          </ButtonGroup>
        </CardItemGroup>
      </CardBody>
    </Card>
  );
};

/**
 * Link content component for standalone use
 */
export const LinkContent: React.FC<{
  editor?: Editor | null;
}> = ({ editor }) => {
  const linkPopover = useLinkPopover({
    editor,
  });

  return <LinkMain {...linkPopover} />;
};

/**
 * Link popover component for Tiptap editors.
 *
 * For custom popover implementations, use the `useLinkPopover` hook instead.
 */
export const LinkPopover = ({
  editor: providedEditor,
  hideWhenUnavailable = false,
  onSetLink,
  onOpenChange,
  autoOpenOnLinkActive = true,
  onClick,
  children,
  ref,
  ...buttonProps
}: LinkPopoverProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = useState(false);

  const {
    isVisible,
    canSet,
    isActive,
    url,
    setUrl,
    setLink,
    removeLink,
    openLink,
    label,
    Icon,
  } = useLinkPopover({
    editor,
    hideWhenUnavailable,
    onSetLink,
  });

  const handleOnOpenChange = useCallback(
    (nextIsOpen: boolean) => {
      setIsOpen(nextIsOpen);
      onOpenChange?.(nextIsOpen);
    },
    [onOpenChange]
  );

  const handleSetLink = useCallback(() => {
    setLink();
    setIsOpen(false);
  }, [setLink]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) {
        return;
      }
      setIsOpen(!isOpen);
    },
    [onClick, isOpen]
  );

  useEffect(() => {
    if (autoOpenOnLinkActive && isActive) {
      setIsOpen(true);
    }
  }, [autoOpenOnLinkActive, isActive]);

  if (!isVisible) {
    return null;
  }

  return (
    <Popover onOpenChange={handleOnOpenChange} open={isOpen}>
      <PopoverTrigger asChild>
        <LinkButton
          aria-label={label}
          aria-pressed={isActive}
          data-active-state={isActive ? "on" : "off"}
          data-disabled={!canSet}
          disabled={!canSet}
          onClick={handleClick}
          {...buttonProps}
          ref={ref}
        >
          {children ?? <Icon className="tiptap-button-icon" />}
        </LinkButton>
      </PopoverTrigger>

      <PopoverContent>
        <LinkMain
          isActive={isActive}
          openLink={openLink}
          removeLink={removeLink}
          setLink={handleSetLink}
          setUrl={setUrl}
          url={url}
        />
      </PopoverContent>
    </Popover>
  );
};

export default LinkPopover;
