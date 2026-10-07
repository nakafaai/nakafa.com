import type { GatewayConfigurationError } from "@repo/backend/confect/gateway/failure";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { Gateway, make } from "@repo/backend/confect/gateway/handle";
import { Effect, Layer } from "effect";

/** The deterministic provider behind the test adapter; each test programs its model. */
export const provider = {
  languageModel: vi.fn<Parameters<typeof make>[0]["languageModel"]>(),
};

/**
 * What the deployment's gateway check finds before the test adapter is built;
 * tests program an unavailable deployment with a GatewayConfigurationError.
 */
export const deployment = vi.fn<
  () => Effect.Effect<void, GatewayConfigurationError>
>(() => Effect.void);

/**
 * The test adapter: production handles (defaults and deadlines) over
 * `provider`, behind the programmable deployment check. Confect functions under
 * test get it by mocking `confect/gateway/live` with it.
 */
export const GatewayTest = Layer.effect(
  Gateway,
  Effect.as(Effect.suspend(deployment), make(provider))
);

/**
 * One failure per reason, with the routing facts the classifier keeps. The
 * gateway names a type only for some bodies, such as the measured
 * `unsupported_parameter` rejection, so the other fixtures carry none.
 */
export const failures = {
  "rate-limit": new GatewayFailure({
    reason: "rate-limit",
    status: 429,
    retryAfter: 2,
    retryable: true,
  }),
  quota: new GatewayFailure({
    reason: "quota",
    status: 402,
    retryable: false,
  }),
  auth: new GatewayFailure({
    reason: "auth",
    status: 401,
    retryable: false,
  }),
  configuration: new GatewayFailure({
    reason: "configuration",
    status: 404,
    retryable: false,
  }),
  invalid: new GatewayFailure({
    reason: "invalid",
    status: 400,
    retryable: false,
    type: "invalid_request_error",
  }),
  "too-large": new GatewayFailure({
    reason: "too-large",
    status: 413,
    retryable: false,
  }),
  timeout: new GatewayFailure({
    reason: "timeout",
    status: 408,
    retryable: true,
  }),
  unavailable: new GatewayFailure({
    reason: "unavailable",
    status: 503,
    retryable: true,
  }),
  network: new GatewayFailure({ reason: "network", retryable: true }),
  interrupted: new GatewayFailure({ reason: "interrupted" }),
  unknown: new GatewayFailure({ reason: "unknown" }),
} satisfies Record<GatewayFailure["reason"], GatewayFailure>;
