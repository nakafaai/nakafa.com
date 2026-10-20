import { beforeEach, describe, expect, it } from "@effect/vitest";
import { JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";

/** Loads a fresh leaf, so each test starts without a client and with an empty queue. */
const loadCapture = () =>
  Effect.promise(() => import("@repo/analytics/posthog/capture"));

/** A PostHog client whose exception method the leaf calls, with every other method stubbed. */
function createClient() {
  return {
    capture: vi.fn(),
    captureException: vi.fn(),
    get_explicit_consent_status: vi.fn(),
    get_property: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    register: vi.fn(),
    reset: vi.fn(),
    setPersonProperties: vi.fn(),
  };
}

describe("analytics/posthog-capture", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.effect("holds a handled exception until the client is published", () =>
    Effect.gen(function* () {
      const capture = yield* loadCapture();
      const client = createClient();

      capture.captureException(new Error("blocked"), {
        source: "pre-publish-test",
      });
      expect(client.captureException).not.toHaveBeenCalled();

      capture.publishAnalyticsClient(client);

      expect(client.captureException).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          name: "OperationalError(pre-publish-test)",
        }),
        { source: "pre-publish-test" }
      );
    })
  );

  it.effect(
    "sends a handled exception at once through a published client",
    () =>
      Effect.gen(function* () {
        const capture = yield* loadCapture();
        const client = createClient();
        capture.publishAnalyticsClient(client);

        capture.captureException(new Error("handled"), {
          source: "published-test",
        });

        expect(client.captureException).toHaveBeenCalledExactlyOnceWith(
          expect.anything(),
          { source: "published-test" }
        );
      })
  );

  it.effect("keeps the first held captures when the wait overflows", () =>
    Effect.gen(function* () {
      const capture = yield* loadCapture();
      const client = createClient();
      for (let index = 0; index < 25; index += 1) {
        capture.captureException(new Error("blocked"), {
          source: `pending-${index}`,
        });
      }
      capture.publishAnalyticsClient(client);

      expect(client.captureException).toHaveBeenCalledTimes(20);
      expect(client.captureException).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        { source: "pending-0" }
      );
      expect(client.captureException).toHaveBeenLastCalledWith(
        expect.anything(),
        { source: "pending-19" }
      );
    })
  );

  it.effect(
    "scrubs the handled error message before the client receives it",
    () =>
      Effect.gen(function* () {
        const capture = yield* loadCapture();
        const client = createClient();
        capture.publishAnalyticsClient(client);

        capture.captureException(new Error("handled user@example.com"), {
          source: "scrub-test",
        });

        const encodedCalls = yield* Schema.encodeUnknownEffect(JsonTextSchema)(
          client.captureException.mock.calls
        );
        expect(encodedCalls).not.toContain("user@example.com");
      })
  );

  it.effect("drops runtime context outside the exact privacy contract", () =>
    Effect.gen(function* () {
      const capture = yield* loadCapture();
      const client = createClient();
      capture.publishAnalyticsClient(client);
      const invalidProperties = {
        source: "browser-test",
        userId: "user-1",
      };

      capture.captureException(new Error("blocked"), invalidProperties);

      expect(client.captureException).not.toHaveBeenCalled();
    })
  );
});
