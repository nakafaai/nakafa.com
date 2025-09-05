"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { IconSquareFilled } from "@tabler/icons-react";
import type { ChatStatus } from "ai";
import { SendIcon } from "lucide-react";
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from "react";
import { Children, memo, useCallback, useEffect, useRef } from "react";
import { SpinnerIcon } from "../ui/icons";

const MIN_HEIGHT = 64;
const MAX_HEIGHT = 164;

type UseAutoResizeTextareaProps = {
  minHeight: number;
  maxHeight?: number;
};

const useAutoResizeTextarea = ({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      // Temporarily shrink to get the right scrollHeight
      textarea.style.height = `${minHeight}px`;

      // Calculate new height
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY)
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    // Set initial height
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  // Adjust height on window resize
  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
};

export type PromptInputProps = HTMLAttributes<HTMLFormElement>;

export const PromptInput = memo(
  ({ className, onSubmit, ...props }: PromptInputProps) => {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      // Reset textarea height on any form submission
      const textarea = e.currentTarget.querySelector<HTMLTextAreaElement>(
        'textarea[name="message"]'
      );

      if (textarea) {
        // Get the minimum height from the textarea's style or default
        textarea.style.height = `${MIN_HEIGHT}px`;
      }

      onSubmit?.(e);
    };

    return (
      <form
        className={cn(
          "w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm",
          className
        )}
        onSubmit={handleSubmit}
        {...props}
      />
    );
  }
);
PromptInput.displayName = "PromptInput";

export type PromptInputTextareaProps = ComponentProps<typeof Textarea> & {
  minHeight?: number;
  maxHeight?: number;
};

export const PromptInputTextarea = memo(
  ({
    onChange,
    className,
    placeholder = "What would you like to know?",
    minHeight = MIN_HEIGHT,
    maxHeight = MAX_HEIGHT,
    ...props
  }: PromptInputTextareaProps) => {
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
      minHeight,
      maxHeight,
    });

    const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
      if (e.key === "Enter") {
        if (e.shiftKey) {
          // Allow newline
          return;
        }

        // Submit on Enter (without Shift)
        e.preventDefault();
        const form = e.currentTarget.form;
        if (form) {
          form.requestSubmit();
        }
      }
    };

    return (
      <Textarea
        className={cn(
          "w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
          "bg-transparent",
          "focus-visible:ring-0",
          className
        )}
        name="message"
        onChange={(e) => {
          adjustHeight();
          onChange?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        ref={textareaRef}
        {...props}
      />
    );
  }
);
PromptInputTextarea.displayName = "PromptInputTextarea";

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputToolbar = ({
  className,
  ...props
}: PromptInputToolbarProps) => (
  <div
    className={cn("flex items-center justify-between p-2", className)}
    {...props}
  />
);

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? "default" : "icon";

  return (
    <Button
      className={cn(
        "shrink-0 gap-1.5",
        variant === "ghost" && "text-muted-foreground",
        newSize === "default" && "px-3",
        className
      )}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: ChatStatus;
  isPending?: boolean;
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  isPending,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <SendIcon className="size-4" />;

  if (status === "submitted" || isPending) {
    Icon = <SpinnerIcon />;
  } else if (status === "streaming") {
    Icon = <IconSquareFilled className="size-4" />;
  }

  return (
    <Button
      className={cn("gap-1.5", className)}
      size={size}
      type="submit"
      variant={status === "streaming" ? "destructive" : variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export const PromptInputModelSelect = (props: PromptInputModelSelectProps) => (
  <Select {...props} />
);

export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const PromptInputModelSelectTrigger = ({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium shadow-none transition-colors ease-out",
      'hover:bg-accent hover:text-accent-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-accent-foreground',
      className
    )}
    {...props}
  />
);

export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export const PromptInputModelSelectContent = ({
  className,
  ...props
}: PromptInputModelSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export const PromptInputModelSelectLabel = ({
  className,
  ...props
}: ComponentProps<typeof SelectLabel>) => (
  <SelectLabel className={cn(className)} {...props} />
);

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export const PromptInputModelSelectItem = ({
  className,
  ...props
}: PromptInputModelSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;

export const PromptInputModelSelectValue = ({
  className,
  ...props
}: PromptInputModelSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
