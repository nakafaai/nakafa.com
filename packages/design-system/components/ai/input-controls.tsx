"use client";

import { Add01Icon, ArrowUp02Icon, StopIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import {
  useOptionalPromptInputController,
  usePromptInputAttachments,
} from "@repo/design-system/lib/prompt-input/context";
import { cn } from "@repo/design-system/lib/utils";
import type { ChatStatus } from "ai";
import {
  type ChangeEvent,
  Children,
  type ClipboardEventHandler,
  type ComponentProps,
  type HTMLAttributes,
  type KeyboardEventHandler,
} from "react";

const submitTextareaOnEnter: KeyboardEventHandler<HTMLTextAreaElement> = (
  event
) => {
  if (event.key !== "Enter") {
    return;
  }
  if (event.nativeEvent.isComposing) {
    return;
  }
  if (event.shiftKey) {
    return;
  }

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
};

/** Props for the prompt input body wrapper. */
export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

/** Preserves prompt input composition without adding a layout box. */
export function PromptInputBody({ className, ...props }: PromptInputBodyProps) {
  return <div className={cn("contents", className)} {...props} />;
}

/** Props for the prompt input textarea. */
export type PromptInputTextareaProps = ComponentProps<
  typeof InputGroupTextarea
>;

/** Renders prompt text with submit-on-enter and pasted-file support. */
export function PromptInputTextarea({
  onChange,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) {
  const controller = useOptionalPromptInputController();
  const attachments = usePromptInputAttachments();

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    const files: File[] = [];
    for (const item of items) {
      if (item.kind !== "file") {
        continue;
      }

      const file = item.getAsFile();
      if (file) {
        files.push(file);
      }
    }

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    attachments.add(files);
  };

  const controlledProps = controller
    ? {
        value: controller.textInput.value,
        onChange: (event: ChangeEvent<HTMLTextAreaElement>) => {
          controller.textInput.setInput(event.currentTarget.value);
          onChange?.(event);
        },
      }
    : { onChange };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onKeyDown={submitTextareaOnEnter}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
      {...controlledProps}
    />
  );
}

/** Props for the prompt input bottom toolbar. */
export type PromptInputToolbarProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

/** Aligns prompt tools and submit actions along the input footer. */
export function PromptInputToolbar({
  className,
  ...props
}: PromptInputToolbarProps) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("justify-between gap-1 p-2", className)}
      {...props}
    />
  );
}

/** Props for grouping prompt input tools. */
export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

/** Groups prompt tools in their established compact row. */
export function PromptInputTools({
  className,
  ...props
}: PromptInputToolsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props} />
  );
}

/** Props for a button composed inside the prompt input toolbar. */
export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

/** Applies prompt toolbar button defaults while preserving caller variants. */
export function PromptInputButton({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) {
  const resolvedSize =
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  return (
    <InputGroupButton
      className={cn(className)}
      size={resolvedSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
}

/** Props for the prompt action menu root. */
export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;

/** Renders the prompt action menu root. */
export function PromptInputActionMenu(props: PromptInputActionMenuProps) {
  return <DropdownMenu {...props} />;
}

/** Props for the prompt action menu trigger. */
export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

/** Renders the prompt action trigger with its default add icon. */
export function PromptInputActionMenuTrigger({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) {
  return (
    <DropdownMenuTrigger
      render={
        <PromptInputButton className={className} {...props}>
          {children ?? <HugeIcons className="size-4" icon={Add01Icon} />}
        </PromptInputButton>
      }
    />
  );
}

/** Props for the prompt action menu popup. */
export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;

/** Anchors prompt actions to the start edge of their trigger. */
export function PromptInputActionMenuContent({
  className,
  ...props
}: PromptInputActionMenuContentProps) {
  return (
    <DropdownMenuContent align="start" className={cn(className)} {...props} />
  );
}

/** Props for one prompt action menu item. */
export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;

/** Renders one action inside the prompt menu. */
export function PromptInputActionMenuItem({
  className,
  ...props
}: PromptInputActionMenuItemProps) {
  return <DropdownMenuItem className={cn(className)} {...props} />;
}

/** Props for the status-aware prompt submit control. */
export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  isPending?: boolean;
};

/** Renders the send, pending, or stop state for a prompt submission. */
export function PromptInputSubmit({
  className,
  variant = "default",
  size = "icon",
  status,
  isPending,
  children,
  ...props
}: PromptInputSubmitProps) {
  let icon = <HugeIcons className="size-4" icon={ArrowUp02Icon} />;
  let statusVariant = variant;

  if (status === "submitted" || isPending) {
    icon = <Spinner />;
  } else if (status === "streaming") {
    icon = <HugeIcons className="size-4" icon={StopIcon} />;
    statusVariant = "destructive";
  }

  return (
    <InputGroupButton
      aria-label="Submit"
      className={cn(className)}
      size={size}
      type="submit"
      variant={statusVariant}
      {...props}
    >
      {children ?? icon}
    </InputGroupButton>
  );
}
