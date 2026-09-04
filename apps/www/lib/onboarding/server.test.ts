// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { Effect } from "effect";
import {
  OnboardingAdmissionError,
  OnboardingStatusReadError,
  readOnboardingStatus,
  recordOnboardingAdmission,
} from "@/lib/onboarding/server";

vi.mock("convex/nextjs", () => ({
  fetchMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

describe("onboarding server adapter", () => {
  it.effect("reads authenticated onboarding status", () =>
    Effect.gen(function* () {
      const status = {
        isAuthenticated: true as const,
        isRequired: true,
        profile: null,
      };
      vi.mocked(fetchQuery).mockResolvedValue(status);

      expect(yield* readOnboardingStatus("test-token")).toEqual(status);
      expect(fetchQuery).toHaveBeenCalledWith(
        api.onboarding.queries.getStatus,
        {},
        { token: "test-token" }
      );
    })
  );

  it.effect("maps onboarding status read failures", () =>
    Effect.gen(function* () {
      const cause = new Error("read unavailable");
      vi.mocked(fetchQuery).mockRejectedValueOnce(cause);

      const error = yield* readOnboardingStatus("test-token").pipe(Effect.flip);

      expect(error).toBeInstanceOf(OnboardingStatusReadError);
      expect(error).toMatchObject({ cause });
    })
  );

  it.effect("records authenticated first-run admission", () =>
    Effect.gen(function* () {
      const admission = {
        isAuthenticated: true as const,
        isRequired: true,
        profile: { updatedAt: 1 },
      };
      vi.mocked(fetchMutation).mockResolvedValue(admission);

      expect(yield* recordOnboardingAdmission("test-token")).toEqual(admission);
      expect(fetchMutation).toHaveBeenCalledWith(
        api.onboarding.mutations.admit,
        {},
        { token: "test-token" }
      );
    })
  );

  it.effect("maps first-run admission failures", () =>
    Effect.gen(function* () {
      const cause = new Error("admission unavailable");
      vi.mocked(fetchMutation).mockRejectedValueOnce(cause);

      const error = yield* recordOnboardingAdmission("test-token").pipe(
        Effect.flip
      );

      expect(error).toBeInstanceOf(OnboardingAdmissionError);
      expect(error).toMatchObject({ cause });
    })
  );
});
