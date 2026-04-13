import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeTryoutPart, startTryoutPart } from "./part";

type TryoutAttemptId = Parameters<typeof startTryoutPart>[0]["tryoutAttemptId"];

const tryoutAttemptId = "tryoutAttemptId" as TryoutAttemptId;

const mocks = vi.hoisted(() => ({
  after: vi.fn(async (callback) => await callback()),
  captureServerException: vi.fn(),
  cookies: vi.fn(),
  extractDistinctIdFromPostHogCookie: vi.fn(),
  fetchAuthMutation: vi.fn(),
  revalidateTryoutOverview: vi.fn(),
  revalidateTryoutSet: vi.fn(),
}));

vi.mock("@repo/analytics/posthog/server", () => ({
  captureServerException: mocks.captureServerException,
  extractDistinctIdFromPostHogCookie: mocks.extractDistinctIdFromPostHogCookie,
}));

vi.mock("next/server", () => ({
  after: mocks.after,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth/server", () => ({
  fetchAuthMutation: mocks.fetchAuthMutation,
}));

vi.mock("@/components/tryout/actions/revalidate", () => ({
  revalidateTryoutOverview: mocks.revalidateTryoutOverview,
  revalidateTryoutSet: mocks.revalidateTryoutSet,
}));

describe("components/tryout/actions/part", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      toString: () => "ph_cookie=user_123",
    });
    mocks.extractDistinctIdFromPostHogCookie.mockReturnValue("user_123");
  });

  it("revalidates routes after starting a part", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "started" });

    const result = await startTryoutPart({
      locale: "id",
      partKey: "mathematical-reasoning",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutAttemptId,
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "started" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledWith({
      locale: "id",
      product: "snbt",
    });
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledWith({
      locale: "id",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutSlug: "2026-set-1",
    });
  });

  it("revalidates routes after an expired part result", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "part-expired" });

    const result = await startTryoutPart({
      locale: "id",
      partKey: "mathematical-reasoning",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutAttemptId,
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "part-expired" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledTimes(1);
  });

  it("captures unexpected start-part failures", async () => {
    const error = new Error("boom");
    mocks.fetchAuthMutation.mockRejectedValue(error);

    const result = await startTryoutPart({
      locale: "id",
      partKey: "mathematical-reasoning",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutAttemptId,
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        locale: "id",
        part_key: "mathematical-reasoning",
        product: "snbt",
        source: "start-tryout-part",
        tryout_attempt_id: "tryoutAttemptId",
        tryout_slug: "2026-set-1",
      }
    );
  });

  it("revalidates routes after completing a part", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "tryout-expired" });

    const result = await completeTryoutPart({
      locale: "id",
      partKey: "mathematical-reasoning",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutAttemptId,
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "tryout-expired" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledWith({
      locale: "id",
      product: "snbt",
    });
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledWith({
      locale: "id",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutSlug: "2026-set-1",
    });
  });

  it("captures unexpected complete-part failures", async () => {
    const error = new Error("boom");
    mocks.fetchAuthMutation.mockRejectedValue(error);

    const result = await completeTryoutPart({
      locale: "id",
      partKey: "mathematical-reasoning",
      partKeys: ["mathematical-reasoning"],
      product: "snbt",
      tryoutAttemptId,
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        locale: "id",
        part_key: "mathematical-reasoning",
        product: "snbt",
        source: "complete-tryout-part",
        tryout_attempt_id: tryoutAttemptId,
        tryout_slug: "2026-set-1",
      }
    );
  });
});
