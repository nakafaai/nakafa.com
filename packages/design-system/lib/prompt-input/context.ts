"use client";

import type { PromptInputFile } from "@repo/design-system/lib/prompt-input/files";
import { createContext, type RefObject, use } from "react";

/** Attachment state shared by prompt input composition components. */
export interface AttachmentsContext {
  add: (files: File[] | FileList) => void;
  clear: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  files: PromptInputFile[];
  openFileDialog: () => void;
  remove: (id: string) => void;
}

/** Context consumed by the form and its composed attachment controls. */
export const LocalAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);

/** Selects one part of the locally owned attachment state of the nearest form. */
export function usePromptInputAttachments<T>(
  selector: (attachments: AttachmentsContext) => T
) {
  const value = use(LocalAttachmentsContext);
  if (!value) {
    throw new Error(
      "usePromptInputAttachments must be used within PromptInput"
    );
  }
  return selector(value);
}
