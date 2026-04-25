"use client";

import { captureException } from "@repo/analytics/posthog";
import { toast } from "sonner";
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
    toast.error(insufficientCreditsMessage, { position: "bottom-center" });
    return;
  }

  captureException(error, {
    source: "chat-provider-send-message",
  });

  toast.error(fallbackMessage, { position: "bottom-center" });
}
