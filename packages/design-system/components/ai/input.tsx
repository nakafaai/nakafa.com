"use client";

import { usePromptInputFiles } from "@repo/design-system/components/ai/input-files";
import { InputGroupTextarea } from "@repo/design-system/components/ui/input-group";
import { isEnterOutsideComposition } from "@repo/design-system/lib/keyboard";
import { runPromptInputProgram } from "@repo/design-system/lib/prompt-input/boundary";
import {
  LocalAttachmentsContext,
  usePromptInputAttachments,
} from "@repo/design-system/lib/prompt-input/context";
import type { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input/files";
import {
  type PromptInputMessage,
  submitPromptInput,
} from "@repo/design-system/lib/prompt-input/submission";
import { cn } from "cn";
import { Array as Arr } from "effect";
import {
  type ChangeEventHandler,
  type ClipboardEventHandler,
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  useEffect,
  useRef,
} from "react";

/**
 * Props for a prompt form with locally owned attachments. `onPick` reports
 * every pick, once it is made: the reasons the pick did not attach its files in
 * full, and an empty list when it attached all of them.
 */
type PromptInputProps = Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  accept?: string;
  /** The name of the hidden file input, in the language of the caller. */
  fileInputLabel: string;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  onPick?: (rejections: readonly PromptInputFileConstraintError[]) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => boolean | Promise<boolean>;
};

function readPromptInputText(form: HTMLFormElement) {
  const value = new FormData(form).get("message");
  return typeof value === "string" ? value : "";
}

/** Owns attachment selection and commits the submitted files only after admission. */
export function PromptInput({
  className,
  accept,
  fileInputLabel,
  multiple,
  maxFiles,
  maxFileSize,
  onPick,
  onSubmit,
  children,
  ...props
}: PromptInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { attachments, files } = usePromptInputFiles({
    ...(accept === undefined ? {} : { accept }),
    inputRef,
    maxFiles,
    ...(maxFileSize === undefined ? {} : { maxFileSize }),
    onPick,
  });
  const addFiles = attachments.add;

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const onDragOver = (event: DragEvent) => {
      if (Arr.contains(event.dataTransfer?.types ?? [], "Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      const droppedFiles = event.dataTransfer?.files;
      if (
        Arr.contains(event.dataTransfer?.types ?? [], "Files") ||
        (droppedFiles && droppedFiles.length > 0)
      ) {
        event.preventDefault();
      }
      if (droppedFiles && droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    };

    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  const addSelectedFiles: ChangeEventHandler<HTMLInputElement> = (event) => {
    const selectedFiles = event.currentTarget.files;
    if (selectedFiles) {
      addFiles(Array.from(selectedFiles));
    }
    event.currentTarget.value = "";
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const text = readPromptInputText(form);
    const submittedFiles = [...files];

    // Admission may commit after Activity hides this form. Let settlement clear
    // accepted files so returning to the draft cannot resend old attachments.
    runPromptInputProgram(
      submitPromptInput({
        event,
        files: submittedFiles,
        onSubmit,
        onSuccess: () => {
          if (readPromptInputText(form) === text) {
            form.reset();
          }
          for (const file of submittedFiles) {
            attachments.remove(file.id);
          }
        },
        text,
      })
    );
  };

  return (
    <LocalAttachmentsContext value={attachments}>
      <input
        accept={accept}
        aria-label={fileInputLabel}
        className="hidden"
        multiple={multiple}
        onChange={addSelectedFiles}
        ref={inputRef}
        title={fileInputLabel}
        type="file"
      />
      {/* The form is the item of a grid in every composer: without a minimum width of
          its own, one long word makes the grid track as wide as the word. */}
      <form
        className={cn("w-full min-w-0", className)}
        onSubmit={handleSubmit}
        ref={formRef}
        {...props}
      >
        {children}
      </form>
    </LocalAttachmentsContext>
  );
}

const submitTextareaOnEnter: KeyboardEventHandler<HTMLTextAreaElement> = (
  event
) => {
  if (!isEnterOutsideComposition(event.nativeEvent)) {
    return;
  }
  if (event.shiftKey) {
    return;
  }

  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
};

/**
 * Props for the prompt input textarea. The placeholder is the caller's words in
 * the caller's language, so the component has none of its own.
 */
type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea> & {
  placeholder: string;
};

/** Renders prompt text with submit-on-enter and pasted-file support. */
export function PromptInputTextarea({
  onChange,
  className,
  placeholder,
  ...props
}: PromptInputTextareaProps) {
  const addAttachments = usePromptInputAttachments(
    (attachments) => attachments.add
  );

  const handlePaste: ClipboardEventHandler<HTMLTextAreaElement> = (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    const files = Arr.flatMap(Arr.fromIterable(items), (item) => {
      const file = item.kind === "file" ? item.getAsFile() : null;
      return file ? [file] : [];
    });

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    addAttachments(files);
  };

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onKeyDown={submitTextareaOnEnter}
      onPaste={handlePaste}
      placeholder={placeholder}
      {...props}
      onChange={onChange}
    />
  );
}
