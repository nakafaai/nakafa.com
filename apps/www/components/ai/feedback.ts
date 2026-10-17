import type { Ref } from "@confect/core";
import { captureException } from "@repo/analytics/posthog/browser";
import {
  isPromptWithinLimit,
  NINA_PROMPT_LENGTH_MESSAGE,
  NinaPromptError,
} from "@repo/backend/client/nina/prompt";
import { NINA_DOCUMENT_MEBIBYTES } from "@repo/backend/client/nina/uploads";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import type { NinaFailureReason } from "@repo/backend/confect/nina/contract/turn";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import { Effect, Option, Schema } from "effect";
import { requireConvexOnline } from "@/lib/convex/online";

/**
 * A transport failure leaves the mutation's outcome unconfirmed. A call refused
 * while the client is offline (`NINA_OFFLINE`) never started, so nothing is
 * unconfirmed and nothing is reported.
 */
export class NinaConnectionError extends Schema.TaggedError<NinaConnectionError>()(
  "NinaConnectionError",
  {
    code: Schema.Literals(["NINA_CONNECTION_FAILED", "NINA_OFFLINE"]),
    message: Schema.String,
  }
) {}

/** A call refused while offline shows the connection failure and its retry, without a report. */
export function requireNinaConnection(
  convex: Parameters<typeof requireConvexOnline>[0]
) {
  return requireConvexOnline(convex).pipe(
    Effect.mapError(
      (offline) =>
        new NinaConnectionError({
          code: "NINA_OFFLINE",
          message: offline.message,
        })
    )
  );
}

export type NinaFailure =
  | Ref.Error<typeof nina.turns.start>
  | Ref.Error<typeof nina.lifecycle.cancel>
  | NinaConnectionError;

/**
 * The recovery a failed response offers: a Retry button that sends the turn's
 * prompt again, a new message, or time.
 */
const ResponseActionSchema = Schema.Literals(["retry", "edit", "wait"]);

/**
 * The recovery a failed send offers. While the learner stays in the chat, a
 * failed send leaves its message and attachments in the composer, so `edit`
 * is the way on: send it again, or change it first. There is no Retry button
 * for a send, because it would send the attachments a second time.
 */
const AdmissionActionSchema = Schema.Literals([
  "edit",
  "wait",
  "credits",
  "sign-in",
  "new-chat",
]);

/**
 * The recovery and the localized message of one failed response. The message
 * is a key of `Ai.failures`, and the `t(...)` calls that read it check that key.
 */
const ResponseFeedbackRowSchema = Schema.Struct({
  action: ResponseActionSchema,
  message: Schema.String,
});

/** A typed admission failure: its recovery, its message, and whether it is reported. */
const FailureFeedbackRowSchema = Schema.Struct({
  action: AdmissionActionSchema,
  message: Schema.String,
  report: Schema.Boolean,
});

/** Every typed admission failure has localized copy and an appropriate recovery. */
export const ninaFailureFeedback = {
  NINA_CONNECTION_FAILED: {
    message: "connection",
    action: "edit",
    report: true,
  },
  NINA_OFFLINE: { message: "connection", action: "edit", report: false },
  INSUFFICIENT_CREDITS: {
    message: "credits",
    action: "credits",
    report: false,
  },
  RATE_LIMITED: { message: "rate-limit", action: "wait", report: false },
  UNAUTHENTICATED: { message: "session", action: "sign-in", report: false },
  UNAUTHORIZED: { message: "account", action: "sign-in", report: false },
  AUTH_READ_FAILED: {
    message: "authentication",
    action: "edit",
    report: true,
  },
  CHAT_NOT_FOUND: {
    message: "missing-chat",
    action: "new-chat",
    report: false,
  },
  FORBIDDEN: { message: "chat-access", action: "new-chat", report: false },
  NINA_CREDIT_IO_FAILED: {
    message: "admission",
    action: "edit",
    report: true,
  },
  NINA_BUSY: { message: "busy", action: "wait", report: false },
  NINA_RETRY_UNAVAILABLE: {
    message: "retry-unavailable",
    action: "edit",
    report: false,
  },
  NINA_REQUEST_CONFLICT: {
    message: "request-conflict",
    action: "edit",
    report: true,
  },
  NINA_WRITE_FAILED: { message: "admission", action: "edit", report: true },
  NINA_CONTEXT_FAILED: { message: "context", action: "edit", report: true },
  NINA_MESSAGE_SIZE: {
    message: "message-size",
    action: "edit",
    report: false,
  },
  NINA_UPLOAD_INVALID: {
    message: "attachment-invalid",
    action: "edit",
    report: false,
  },
  NINA_UPLOAD_LIMIT: {
    message: "attachment-limit",
    action: "wait",
    report: false,
  },
  NINA_UPLOAD_SIZE: {
    message: "attachment-size",
    action: "edit",
    report: false,
  },
  NINA_UPLOAD_FAILED: {
    message: "attachment-failed",
    action: "edit",
    report: true,
  },
  // A message over the length limit and a message over the turn budget are
  // both too long for one turn, and the learner reads one sentence for them.
  NINA_PROMPT_LENGTH: {
    message: "message-size",
    action: "edit",
    report: false,
  },
} as const satisfies Record<
  NinaFailure["code"],
  typeof FailureFeedbackRowSchema.Type
>;

/**
 * The numbers the copy of a failure names, from the limits the code checks.
 * Every place that words a failure passes them, so a sentence never says a
 * limit the code does not check. An admission failure's copy is the toast copy
 * of `Toast.failure-*`, and a persisted response failure reads `Ai.failures`.
 */
export const ninaFailureLimits = {
  size: NINA_DOCUMENT_MEBIBYTES,
};

/**
 * The refusal of a press on the send button, or nothing. A prompt over the
 * limit stays in the composer, the learner is told it is too long for one
 * turn, and nothing is asked of the server. Every composer sends the text
 * trimmed, so the trimmed length is the one that counts. While a reply streams,
 * a press sends no text, so the limit does not apply to it.
 */
export function promptRefusal(text: string | undefined, answering: boolean) {
  if (answering || isPromptWithinLimit(text?.trim() ?? "")) {
    return Option.none();
  }
  return Option.some(
    new NinaPromptError({
      code: "NINA_PROMPT_LENGTH",
      message: NINA_PROMPT_LENGTH_MESSAGE,
    })
  );
}

/** Persisted failures retain their own recovery policy when history is reopened. */
export const ninaResponseFeedback = {
  "provider-busy": { message: "provider-busy", action: "retry" },
  "provider-unavailable": { message: "provider-unavailable", action: "retry" },
  "service-configuration": { message: "service-configuration", action: "wait" },
  "request-rejected": { message: "request-rejected", action: "edit" },
  "input-too-large": { message: "input-too-large", action: "edit" },
  "response-timeout": { message: "response-timeout", action: "retry" },
  "content-blocked": { message: "content-blocked", action: "edit" },
  "response-limit": { message: "response-limit", action: "edit" },
  interrupted: { message: "interrupted", action: "retry" },
  unknown: { message: "unknown", action: "retry" },
} as const satisfies Record<
  typeof NinaFailureReason.Type,
  typeof ResponseFeedbackRowSchema.Type
>;

/**
 * Where a notice about the composer shows: at the top, so the text box and the
 * send button stay in reach while it does. The composer sits at the bottom of
 * the page and of the sheet, where a notice would cover it on a phone.
 */
const NINA_NOTICE_POSITION = "top-center";

/**
 * Report operational failures and show only the caller's localized copy. A
 * failure has one notice: a failure that says the same thing again, such as
 * Enter pressed again on a prompt that is too long, updates the notice in
 * place instead of stacking a copy of it.
 */
export const reportNinaFailure = Effect.fn("nina.feedback")(function* (
  error: NinaFailure,
  copy: ToastCopy
) {
  yield* Effect.sync(() => {
    const feedback = ninaFailureFeedback[error.code];
    if (feedback.report) {
      captureException(error, { source: "nina-admission" });
    }
    toast.error(copy, {
      id: `nina-failure-${feedback.message}`,
      position: NINA_NOTICE_POSITION,
    });
  });
});
