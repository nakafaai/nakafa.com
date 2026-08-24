"use client";

import {
  InputGroup,
  InputGroupTextarea,
} from "@repo/design-system/components/ui/input-group";
import { cn } from "@repo/design-system/lib/utils";
import type {
  ClipboardEventHandler,
  ComponentProps,
  DragEventHandler,
  FormEvent,
  FormEventHandler,
  KeyboardEventHandler,
} from "react";

type TextPromptProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (text: string, event: FormEvent<HTMLFormElement>) => void;
};

const includesDraggedFile = (types: readonly string[]) =>
  types.includes("Files");

/** Renders a prompt form for capabilities that do not accept attachments. */
export function TextPrompt({
  children,
  className,
  onDragOver,
  onDrop,
  onSubmit,
  ...props
}: TextPromptProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const value = new FormData(event.currentTarget).get("message");
    onSubmit(typeof value === "string" ? value : "", event);
  };

  const handleDragOver: DragEventHandler<HTMLFormElement> = (event) => {
    if (includesDraggedFile(event.dataTransfer.types)) {
      event.preventDefault();
    }
    onDragOver?.(event);
  };

  const handleDrop: DragEventHandler<HTMLFormElement> = (event) => {
    if (
      includesDraggedFile(event.dataTransfer.types) ||
      event.dataTransfer.files.length > 0
    ) {
      event.preventDefault();
    }
    onDrop?.(event);
  };

  return (
    <form
      className="w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onSubmit={handleSubmit}
      {...props}
    >
      <InputGroup className={cn("bg-card", className)}>{children}</InputGroup>
    </form>
  );
}

const submitOnEnter: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
  if (
    event.key !== "Enter" ||
    event.nativeEvent.isComposing ||
    event.shiftKey
  ) {
    return;
  }

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
};

const rejectFilePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
  const includesFile = Array.from(event.clipboardData.items).some(
    (item) => item.kind === "file"
  );
  if (includesFile) {
    event.preventDefault();
  }
};

/** Preserves prompt keyboard behavior without loading attachment machinery. */
export function TextPromptTextarea({
  className,
  placeholder = "What would you like to know?",
  ...props
}: ComponentProps<typeof InputGroupTextarea>) {
  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onKeyDown={submitOnEnter}
      onPaste={rejectFilePaste}
      placeholder={placeholder}
      {...props}
    />
  );
}
