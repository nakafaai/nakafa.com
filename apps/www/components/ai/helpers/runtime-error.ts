"use client";

import { captureException } from "@repo/analytics/posthog/browser";
import { Effect } from "effect";
import { toast } from "sonner";
import { CHAT_ERRORS } from "@/app/api/chat/constants";

interface ReportChatRuntimeErrorOptions {
  error: Error;
  fallbackMessage: string;
  insufficientCreditsMessage: string;
  rateLimitMessage: string;
}

/** Reports one chat runtime error and shows the matching user-facing toast. */
export const reportChatRuntimeError = Effect.fn("chat.reportRuntimeError")(
  function* ({
    error,
    fallbackMessage,
    insufficientCreditsMessage,
    rateLimitMessage,
  }: ReportChatRuntimeErrorOptions) {
    const errorCode = error.message.trim();

    if (errorCode === CHAT_ERRORS.INSUFFICIENT_CREDITS.code) {
      yield* Effect.sync(() =>
        toast.error(insufficientCreditsMessage, { position: "bottom-center" })
      );
      return;
    }

    if (errorCode === CHAT_ERRORS.RATE_LIMITED.code) {
      yield* Effect.sync(() =>
        toast.error(rateLimitMessage, { position: "bottom-center" })
      );
      return;
    }

    yield* Effect.sync(() => {
      captureException(error, { source: "chat-provider-send-message" });
      toast.error(fallbackMessage, { position: "bottom-center" });
    });
  }
);
