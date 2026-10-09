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
 * gateway documents a type only for some bodies, such as the `provider`
 * rejection, whose type is `invalid_request_error`, so the other fixtures
 * carry none.
 */
export const failures = {
  "rate-limit": GatewayFailure.make({
    reason: "rate-limit",
    status: 429,
    retryAfter: 2,
    retryable: true,
  }),
  quota: GatewayFailure.make({
    reason: "quota",
    status: 402,
    retryable: false,
  }),
  auth: GatewayFailure.make({
    reason: "auth",
    status: 401,
    retryable: false,
  }),
  configuration: GatewayFailure.make({
    reason: "configuration",
    status: 404,
    retryable: false,
  }),
  invalid: GatewayFailure.make({
    reason: "invalid",
    status: 400,
    retryable: false,
    type: "invalid_request_error",
  }),
  "too-large": GatewayFailure.make({
    reason: "too-large",
    status: 413,
    retryable: false,
  }),
  timeout: GatewayFailure.make({
    reason: "timeout",
    status: 408,
    retryable: true,
  }),
  unavailable: GatewayFailure.make({
    reason: "unavailable",
    status: 503,
    retryable: true,
  }),
  network: GatewayFailure.make({ reason: "network", retryable: true }),
  interrupted: GatewayFailure.make({ reason: "interrupted" }),
  unknown: GatewayFailure.make({ reason: "unknown" }),
} satisfies Record<GatewayFailure["reason"], GatewayFailure>;
