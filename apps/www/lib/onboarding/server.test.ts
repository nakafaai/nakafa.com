vi.mock("@/env.client", () => ({
  clientEnv: {
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
const layerMock = vi.hoisted(() => vi.fn());
const { fetchMutation, fetchQuery } = vi.hoisted(() => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import onboarding from "@repo/backend/confect/_generated/refs/onboarding";
import { Duration, Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  OnboardingAdmissionError,
  OnboardingStatusReadError,
  readOnboardingStatus,
  recordOnboardingAdmission,
} from "@/lib/onboarding/server";

vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) => {
        layerMock(...args);
        return Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: fetchQuery,
              mutation: fetchMutation,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args)));
      },
    },
  };
});
describe("onboarding server adapter", () => {
  it.effect("reads authenticated onboarding status", () =>
    Effect.gen(function* () {
      const status = {
        isAuthenticated: true as const,
        isRequired: true,
        profile: null,
      };
      vi.mocked(fetchQuery).mockReturnValue(Effect.succeed(status));
      expect(yield* readOnboardingStatus("test-token")).toEqual(status);
      expect(fetchQuery).toHaveBeenCalledWith(onboarding.queries.getStatus, {});
      expect(layerMock).toHaveBeenCalledWith("https://test.convex.cloud", {
        auth: "test-token",
      });
    })
  );
  it.effect("maps onboarding status read failures", () =>
    Effect.gen(function* () {
      const cause = new Error("read unavailable");
      vi.mocked(fetchQuery).mockReturnValueOnce(Effect.fail(cause));
      const error = yield* readOnboardingStatus("test-token").pipe(Effect.flip);
      expect(error).toBeInstanceOf(OnboardingStatusReadError);
      expect(error).toMatchObject({
        cause,
      });
    })
  );
  it.effect("records authenticated first-run admission", () =>
    Effect.gen(function* () {
      const admission = {
        isAuthenticated: true as const,
        isRequired: true,
        profile: {
          updatedAt: 1,
        },
      };
      vi.mocked(fetchMutation).mockReturnValue(Effect.succeed(admission));
      expect(yield* recordOnboardingAdmission("test-token")).toEqual(admission);
      expect(fetchMutation).toHaveBeenCalledWith(
        onboarding.mutations.admit,
        {}
      );
      expect(layerMock).toHaveBeenCalledWith("https://test.convex.cloud", {
        auth: "test-token",
      });
    })
  );
  it.effect("maps first-run admission failures", () =>
    Effect.gen(function* () {
      const cause = new Error("admission unavailable");
      vi.mocked(fetchMutation).mockReturnValueOnce(Effect.fail(cause));
      const error = yield* recordOnboardingAdmission("test-token").pipe(
        Effect.flip
      );
      expect(error).toBeInstanceOf(OnboardingAdmissionError);
      expect(error).toMatchObject({
        cause,
      });
    })
  );
  it.effect("fails first-run admission at its deadline, without a retry", () =>
    Effect.gen(function* () {
      vi.mocked(fetchMutation).mockReturnValueOnce(Effect.never);
      const fiber = yield* Effect.forkChild(
        recordOnboardingAdmission("test-token").pipe(Effect.flip)
      );

      yield* TestClock.adjust(Duration.seconds(10));
      const error = yield* Fiber.join(fiber);

      expect(error).toBeInstanceOf(OnboardingAdmissionError);
      expect(error).toMatchObject({ cause: { _tag: "TimeoutError" } });
      expect(fetchMutation).toHaveBeenCalledOnce();
    })
  );
});
