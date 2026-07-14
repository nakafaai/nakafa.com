"use client";

import {
  PromptInputAttachmentsProvider,
  useOptionalPromptInputController,
} from "@repo/design-system/components/ai/input-context";
import { usePromptInputFiles } from "@repo/design-system/components/ai/input-files";
import { InputGroup } from "@repo/design-system/components/ui/input-group";
import {
  type PromptInputMessage,
  submitPromptInput,
} from "@repo/design-system/lib/prompt-input";
import { runPromptInputProgram } from "@repo/design-system/lib/prompt-input-boundary";
import type { PromptInputFileConstraintError } from "@repo/design-system/lib/prompt-input-files";
import { cn } from "@repo/design-system/lib/utils";
import { Effect, Fiber } from "effect";
import {
  type ChangeEventHandler,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  useEffect,
  useRef,
} from "react";

/** Props for the self-managed or provider-controlled prompt input form. */
export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  accept?: string;
  globalDrop?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  multiple?: boolean;
  onError?: (error: PromptInputFileConstraintError) => void;
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>;
};

function readPromptInputText(form: HTMLFormElement) {
  const value = new FormData(form).get("message");
  return typeof value === "string" ? value : "";
}

/** Renders a prompt form with local attachments or its nearest provider state. */
export function PromptInput({
  className,
  accept,
  multiple,
  globalDrop,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  children,
  ...props
}: PromptInputProps) {
  const controller = useOptionalPromptInputController();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitFibersRef = useRef(new Set<Fiber.RuntimeFiber<void, never>>());
  const { attachments, files } = usePromptInputFiles({
    accept,
    controller,
    inputRef,
    maxFiles,
    maxFileSize,
    onError,
  });
  const addFiles = attachments.add;

  useEffect(
    () => () => {
      const fibers = [...submitFibersRef.current];
      submitFibersRef.current.clear();
      Effect.runFork(Fiber.interruptAll(fibers));
    },
    []
  );

  useEffect(() => {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      const droppedFiles = event.dataTransfer?.files;
      if (
        event.dataTransfer?.types?.includes("Files") ||
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

  useEffect(() => {
    if (!globalDrop) {
      return;
    }

    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
    };
    const onDrop = (event: DragEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
      }
      if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
        addFiles(event.dataTransfer.files);
      }
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [addFiles, globalDrop]);

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
    const text = controller
      ? controller.textInput.value
      : readPromptInputText(form);
    const submittedFiles = [...files];

    if (!controller) {
      form.reset();
    }

    const fiber = runPromptInputProgram(
      submitPromptInput({
        event,
        files: submittedFiles,
        onSubmit,
        onSuccess: () => {
          for (const file of submittedFiles) {
            attachments.remove(file.id);
          }
          controller?.textInput.clearIfUnchanged(text);
        },
        text,
      })
    );
    submitFibersRef.current.add(fiber);
    fiber.addObserver(() => submitFibersRef.current.delete(fiber));
  };

  const inner = (
    <>
      <input
        accept={accept}
        aria-label="Upload files"
        className="hidden"
        multiple={multiple}
        onChange={addSelectedFiles}
        ref={inputRef}
        title="Upload files"
        type="file"
      />
      <form className="w-full" onSubmit={handleSubmit} ref={formRef} {...props}>
        <InputGroup className={cn("border-input bg-card", className)}>
          {children}
        </InputGroup>
      </form>
    </>
  );

  return (
    <PromptInputAttachmentsProvider attachments={attachments}>
      {inner}
    </PromptInputAttachmentsProvider>
  );
}
