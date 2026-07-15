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

/** Controlled prompt text exposed by the optional provider. */
export interface TextInputContext {
  clear: () => void;
  clearIfUnchanged: (submittedValue: string) => void;
  setInput: (value: string) => void;
  value: string;
}

/** State and file-input registration exposed by the optional provider. */
export interface PromptInputController {
  /** Connects the provider to the hidden file input owned by PromptInput. */
  __registerFileInput: (
    ref: RefObject<HTMLInputElement | null>,
    open: () => void
  ) => void;
  attachments: AttachmentsContext;
  textInput: TextInputContext;
}

/** @internal Context consumed by the prompt input provider and controller hook. */
export const PromptInputContext = createContext<PromptInputController | null>(
  null
);

/** @internal Context consumed by provider-backed attachment components. */
export const ProviderAttachmentsContext =
  createContext<AttachmentsContext | null>(null);

/** @internal Context consumed by one locally managed prompt input. */
export const LocalAttachmentsContext = createContext<AttachmentsContext | null>(
  null
);

/** Reads the required prompt controller from the nearest global provider. */
export function usePromptInputController() {
  const context = use(PromptInputContext);
  if (!context) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use usePromptInputController()."
    );
  }
  return context;
}

/** Reads the global prompt controller when one is present. */
export function useOptionalPromptInputController() {
  return use(PromptInputContext);
}

/** Reads the required attachment state from the nearest global provider. */
export function useProviderAttachments() {
  const context = use(ProviderAttachmentsContext);
  if (!context) {
    throw new Error(
      "Wrap your component inside <PromptInputProvider> to use useProviderAttachments()."
    );
  }
  return context;
}

/** Reads global attachment state when a provider is present. */
export function useOptionalProviderAttachments() {
  return use(ProviderAttachmentsContext);
}

/** Reads provider attachment state first, then local PromptInput state. */
export function usePromptInputAttachments() {
  const provider = useOptionalProviderAttachments();
  const scoped = use(LocalAttachmentsContext);
  const context = scoped ?? provider;
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput or PromptInputProvider"
    );
  }
  return context;
}
