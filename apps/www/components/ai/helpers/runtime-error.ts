"use client";

import { captureException } from "@repo/analytics/posthog";
import { toastManager } from "@repo/design-system/components/ui/toast";
import { CHAT_ERRORS } from "@/app/api/chat/constants";

interface ReportChatRuntimeErrorOptions {
  error: Error;
  fallbackMessage: string;
  insufficientCreditsMessage: string;
}

/** Reports one chat runtime error and shows the matching user-facing toast. */
export function reportChatRuntimeError({
  error,
  fallbackMessage,
  insufficientCreditsMessage,
}: ReportChatRuntimeErrorOptions) {
  const errorCode = error.message.trim();

  if (errorCode === CHAT_ERRORS.INSUFFICIENT_CREDITS.code) {
    toastManager.add({ type: "error", title: insufficientCreditsMessage });
    return;
  }

  captureException(error, {
    source: "chat-provider-send-message",
  });

  toastManager.add({ type: "error", title: fallbackMessage });
}
