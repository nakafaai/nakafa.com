import { primaryTryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { locales } from "@repo/utilities/locales";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeTryoutPart,
  startTryoutPart,
} from "@/components/tryout/actions/part";
import { decodeTryoutAttemptId } from "@/lib/data/convex-ids";

const testLocale = locales[1];
const tryoutPartKey = "mathematical-reasoning";
const tryoutPartKeys = [tryoutPartKey] as const;
const tryoutSlug = "2026-set-1";
const tryoutAttemptId = decodeTryoutAttemptId("tryoutAttemptId");

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
      locale: testLocale,
      partKey: tryoutPartKey,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutAttemptId,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "started" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledWith({
      locale: testLocale,
      product: primaryTryoutProduct,
    });
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledWith({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutSlug,
    });
  });

  it("revalidates routes after an expired part result", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "part-expired" });

    const result = await startTryoutPart({
      locale: testLocale,
      partKey: tryoutPartKey,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutAttemptId,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "part-expired" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledTimes(1);
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledTimes(1);
  });

  it("captures unexpected start-part failures", async () => {
    const error = new Error("boom");
    mocks.fetchAuthMutation.mockRejectedValue(error);

    const result = await startTryoutPart({
      locale: testLocale,
      partKey: tryoutPartKey,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutAttemptId,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        locale: testLocale,
        part_key: tryoutPartKey,
        product: primaryTryoutProduct,
        source: "start-tryout-part",
        tryout_attempt_id: "tryoutAttemptId",
        tryout_slug: tryoutSlug,
      }
    );
  });

  it("revalidates routes after completing a part", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "tryout-expired" });

    const result = await completeTryoutPart({
      locale: testLocale,
      partKey: tryoutPartKey,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutAttemptId,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "tryout-expired" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledWith({
      locale: testLocale,
      product: primaryTryoutProduct,
    });
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledWith({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutSlug,
    });
  });

  it("captures unexpected complete-part failures", async () => {
    const error = new Error("boom");
    mocks.fetchAuthMutation.mockRejectedValue(error);

    const result = await completeTryoutPart({
      locale: testLocale,
      partKey: tryoutPartKey,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      tryoutAttemptId,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        locale: testLocale,
        part_key: tryoutPartKey,
        product: primaryTryoutProduct,
        source: "complete-tryout-part",
        tryout_attempt_id: tryoutAttemptId,
        tryout_slug: tryoutSlug,
      }
    );
  });
});
