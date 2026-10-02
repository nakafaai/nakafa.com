import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { Gateway, make } from "@repo/backend/confect/gateway/handle";
import type { GatewayConfigurationError } from "@repo/backend/confect/gateway/key";
import { Effect, Layer } from "effect";

/** The deterministic provider behind the test adapter; each test programs its model. */
export const provider = {
  languageModel: vi.fn<Parameters<typeof make>[0]["languageModel"]>(),
};

/**
 * What the deployment's key check finds before the test adapter is built;
 * tests program a missing key with a GatewayConfigurationError.
 */
export const deployment = vi.fn<
  () => Effect.Effect<void, GatewayConfigurationError>
>(() => Effect.void);

/**
 * The test adapter: production handles (defaults, routing, deadlines) over
 * `provider`, behind the programmable key check. Confect functions under test
 * get it by mocking `confect/gateway/live` with it.
 */
export const GatewayTest = Layer.effect(
  Gateway,
  Effect.as(Effect.suspend(deployment), make(provider))
);

/** One failure per reason, with the routing facts the classifier keeps. */
export const failures = {
  "rate-limit": new GatewayFailure({
    reason: "rate-limit",
    status: 429,
    retryAfter: 2,
    retryable: true,
    generation: "gen_test-1",
    type: "rate_limit_exceeded",
  }),
  quota: new GatewayFailure({
    reason: "quota",
    status: 402,
    retryable: false,
    type: "internal_server_error",
  }),
  auth: new GatewayFailure({
    reason: "auth",
    status: 401,
    retryable: false,
    type: "authentication_error",
  }),
  configuration: new GatewayFailure({
    reason: "configuration",
    status: 404,
    retryable: false,
    type: "model_not_found",
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
    type: "timeout_error",
  }),
  unavailable: new GatewayFailure({
    reason: "unavailable",
    status: 503,
    retryable: true,
    type: "internal_server_error",
  }),
  network: new GatewayFailure({ reason: "network", retryable: true }),
  interrupted: new GatewayFailure({ reason: "interrupted" }),
  unknown: new GatewayFailure({ reason: "unknown" }),
} satisfies Record<GatewayFailure["reason"], GatewayFailure>;
