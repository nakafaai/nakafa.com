import { standsOnPublicAddresses } from "@repo/backend/confect/integrations/receiver";
import {
  SIGNATURE_HEADER,
  signBody,
} from "@repo/backend/confect/integrations/signature";
import { FetchClient } from "@repo/utilities/http/client";
import { Clock, Duration, Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpBody, HttpClient } from "effect/http";

/** How long one attempt may take, the check of its receiver included (ADR 0020). */
const ATTEMPT_DEADLINE = Duration.seconds(10);

/**
 * The Fetch client with redirects returned as they are: a receiver is judged before it is
 * called, so a redirect must never reach an address nobody judged. Only the Fetch client
 * honors that option.
 */
const ReceiverClient = FetchClient.pipe(
  Layer.provide(
    Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" })
  )
);

/**
 * Sends one attempt: judges the receiver, signs a new timestamp and the body, and posts it,
 * reading only the status of the answer. A 2xx status delivers the change; any other, a
 * redirect included, fails the attempt.
 */
const send = Effect.fn("integrations.hooks.send")(function* (attempt: {
  readonly attempt: number;
  readonly body: string;
  readonly event: string;
  readonly secret: string;
  readonly type: string;
  readonly url: string;
}) {
  const started = yield* Clock.currentTimeMillis;
  const spent = Effect.map(Clock.currentTimeMillis, (now) => now - started);
  if (!(yield* standsOnPublicAddresses(attempt.url))) {
    return {
      code: null,
      ms: yield* spent,
      reason: "address" as const,
      status: "failed" as const,
    };
  }
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const response = yield* client.post(attempt.url, {
    body: HttpBody.text(attempt.body, "application/json"),
    headers: {
      "nakafa-attempt": String(attempt.attempt),
      "nakafa-event": attempt.event,
      "nakafa-event-type": attempt.type,
      [SIGNATURE_HEADER]: yield* signBody(
        attempt.secret,
        Math.floor(started / Duration.toMillis(Duration.seconds(1))),
        attempt.body
      ),
    },
  });
  const ms = yield* spent;
  return response.status >= 200 && response.status < 300
    ? { code: response.status, ms, status: "delivered" as const }
    : {
        code: response.status,
        ms,
        reason: "status" as const,
        status: "failed" as const,
      };
}, Effect.scoped);

/** One attempt with its deadline, where a transport failure is a failed attempt and never a defect. */
export const attemptOf = (attempt: Parameters<typeof send>[0]) =>
  send(attempt).pipe(
    Effect.provide(ReceiverClient),
    Effect.timeoutOption(ATTEMPT_DEADLINE),
    Effect.map(
      Option.getOrElse(() => ({
        code: null,
        ms: Duration.toMillis(ATTEMPT_DEADLINE),
        reason: "deadline" as const,
        status: "failed" as const,
      }))
    ),
    Effect.catch(() =>
      Effect.succeed({
        code: null,
        ms: 0,
        reason: "network" as const,
        status: "failed" as const,
      })
    )
  );
