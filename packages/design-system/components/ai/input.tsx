"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { SendIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  ComponentProps,
  HTMLAttributes,
  KeyboardEventHandler,
} from "react";
import { Children, useCallback, useEffect, useRef } from "react";

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

export type AIInputProps = HTMLAttributes<HTMLFormElement>;
export const AIInput = ({ className, ...props }: AIInputProps) => (
  <form
    className={cn(
      "w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm",
      className
    )}
    {...props}
  />
);

export type AIInputTextareaProps = ComponentProps<typeof Textarea> & {
  minHeight?: number;
  maxHeight?: number;
};
export const AIInputTextarea = ({
  onChange,
  className,
  placeholder,
  minHeight = 48,
  maxHeight = 164,
  ...props
}: AIInputTextareaProps) => {
  const t = useTranslations("Ai");

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight,
    maxHeight,
  });
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
        "min-h-8 w-full resize-none rounded-none border-none p-3 shadow-none outline-none ring-0",
        "bg-transparent dark:bg-transparent",
        "focus-visible:ring-0",
        className
      )}
      name="message"
      onChange={(e) => {
        adjustHeight();
        onChange?.(e);
      }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder ?? t("text-placeholder")}
      ref={textareaRef}
      {...props}
    />
  );
};

export type AIInputToolbarProps = HTMLAttributes<HTMLDivElement>;
export const AIInputToolbar = ({
  className,
  ...props
}: AIInputToolbarProps) => (
  <div
    className={cn("flex items-center justify-between p-2", className)}
    {...props}
  />
);

export type AIInputToolsProps = HTMLAttributes<HTMLDivElement>;
export const AIInputTools = ({ className, ...props }: AIInputToolsProps) => (
  <div
    className={cn(
      "flex items-center gap-1",
      "[&_button:first-child]:rounded-bl-xl",
      className
    )}
    {...props}
  />
);

export type AIInputButtonProps = ComponentProps<typeof Button>;
export const AIInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: AIInputButtonProps) => {
  const newSize =
    (size ?? Children.count(props.children) > 1) ? "default" : "icon";
  return (
    <Button
      className={cn(
        "shrink-0 gap-1.5 rounded-lg",
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

export type AIInputSubmitProps = ComponentProps<typeof Button> & {
  status?: "submitted" | "streaming" | "ready" | "error";
};
export const AIInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: AIInputSubmitProps) => {
  const defaultVariant = status === "streaming" ? "destructive" : variant;

  let Icon = <SendIcon />;
  if (status === "submitted") {
    Icon = <SpinnerIcon className="animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon />;
  }

  return (
    <Button
      className={cn(className)}
      size={size}
      type="submit"
      variant={defaultVariant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

export type AIInputModelSelectProps = ComponentProps<typeof Select>;
export const AIInputModelSelect = (props: AIInputModelSelectProps) => (
  <Select {...props} />
);

export type AIInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;
export const AIInputModelSelectTrigger = ({
  className,
  ...props
}: AIInputModelSelectTriggerProps) => (
  <SelectTrigger
    className={cn(
      "border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors",
      'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
      className
    )}
    {...props}
  />
);

export type AIInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;
export const AIInputModelSelectContent = ({
  className,
  ...props
}: AIInputModelSelectContentProps) => (
  <SelectContent className={cn(className)} {...props} />
);

export type AIInputModelSelectItemProps = ComponentProps<typeof SelectItem>;
export const AIInputModelSelectItem = ({
  className,
  ...props
}: AIInputModelSelectItemProps) => (
  <SelectItem className={cn(className)} {...props} />
);

export type AIInputModelSelectValueProps = ComponentProps<typeof SelectValue>;
export const AIInputModelSelectValue = ({
  className,
  ...props
}: AIInputModelSelectValueProps) => (
  <SelectValue className={cn(className)} {...props} />
);
