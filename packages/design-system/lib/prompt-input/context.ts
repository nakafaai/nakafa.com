"use client";

import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import type { RefObject } from "react";
import { createContext, useContextSelector } from "use-context-selector";

/** Attachment state shared by prompt input composition components. */
export interface AttachmentsContext {
  add: (files: File[] | FileList) => void;
  clear: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  files: PromptInputFile[];
  openFileDialog: () => void;
  remove: (id: string) => void;
}

const missingAttachments = Symbol("missing-prompt-input-attachments");

/** Context consumed by the form and its composed attachment controls. */
export const LocalAttachmentsContext = createContext<
  AttachmentsContext | typeof missingAttachments
>(missingAttachments);

/** Selects one part of the locally owned attachment state of the nearest form. */
export function usePromptInputAttachments<T>(
  selector: (attachments: AttachmentsContext) => T
) {
  const selected = useContextSelector(LocalAttachmentsContext, (value) =>
    value === missingAttachments ? missingAttachments : selector(value)
  );
  if (selected === missingAttachments) {
    throw new Error(
      "usePromptInputAttachments must be used within PromptInput"
    );
  }
  return selected;
}
