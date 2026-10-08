"use client";

import type { usePromptInputFiles } from "@repo/design-system/components/ai/input-files";
import { createContext, use } from "react";

/** Attachment state shared by prompt input composition components. */
type AttachmentsContext = ReturnType<typeof usePromptInputFiles>["attachments"];

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
