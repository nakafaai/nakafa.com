import type { Ref } from "@confect/core";
import { captureException } from "@repo/analytics/posthog/browser";
import type refs from "@repo/backend/confect/_generated/refs";
import type { NinaFailureReason } from "@repo/backend/confect/nina/turns.spec";
import { Effect, Schema } from "effect";
import type { AppConfig } from "next-intl";
import { toast } from "sonner";

/** A transport failure leaves the mutation's outcome unconfirmed. */
export class NinaConnectionError extends Schema.TaggedError<NinaConnectionError>()(
  "NinaConnectionError",
  { code: Schema.Literal("NINA_CONNECTION_FAILED"), message: Schema.String }
) {}

export type NinaFailure =
  | Ref.Error<typeof refs.public.nina.turns.start>
  | Ref.Error<typeof refs.public.nina.lifecycle.cancel>
  | NinaConnectionError;

interface Feedback {
  action: "retry" | "edit" | "wait" | "credits" | "sign-in" | "new-chat";
  message: keyof AppConfig["Messages"]["Ai"]["failures"];
  report: boolean;
}

/** Every typed admission failure has localized copy and an appropriate recovery. */
export const ninaFailureFeedback = {
  NINA_CONNECTION_FAILED: {
    message: "connection",
    action: "retry",
    report: true,
  },
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
    action: "retry",
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
    action: "retry",
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
  NINA_WRITE_FAILED: { message: "admission", action: "retry", report: true },
  NINA_CONTEXT_FAILED: { message: "context", action: "retry", report: true },
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
    action: "retry",
    report: true,
  },
} as const satisfies Record<NinaFailure["code"], Feedback>;

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
  Omit<Feedback, "report">
>;

/** Report operational failures and show only the caller's localized message. */
export const reportNinaFailure = Effect.fn("nina.feedback")(function* (
  error: NinaFailure,
  message: string
) {
  yield* Effect.sync(() => {
    if (ninaFailureFeedback[error.code].report) {
      captureException(error, { source: "nina-admission" });
    }
    toast.error(message, { position: "bottom-center" });
  });
});
