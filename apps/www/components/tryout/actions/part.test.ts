import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeTryoutPart,
  startTryoutPart,
} from "@/components/tryout/actions/part";

type TryoutAttemptId = Parameters<typeof startTryoutPart>[0]["tryoutAttemptId"];

const tryoutAttemptId = "tryoutAttemptId" as TryoutAttemptId;

const mocks = vi.hoisted(() => {
  /** Test double for unauthenticated server-action calls. */
  class MockAuthenticationRequiredError extends Error {}

  return {
    AuthenticationRequiredError: MockAuthenticationRequiredError,
    fetchAuthMutation: vi.fn(),
    requireAuth: vi.fn(),
    revalidateTryoutOverview: vi.fn(),
    revalidateTryoutSet: vi.fn(),
    scheduleCurrentServerExceptionCapture: vi.fn(),
  };
});

vi.mock("@/lib/analytics/server", () => ({
  scheduleCurrentServerExceptionCapture:
    mocks.scheduleCurrentServerExceptionCapture,
}));

vi.mock("@/lib/auth/server", () => ({
  AuthenticationRequiredError: mocks.AuthenticationRequiredError,
  fetchAuthMutation: mocks.fetchAuthMutation,
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/components/tryout/actions/revalidate", () => ({
  revalidateTryoutOverview: mocks.revalidateTryoutOverview,
  revalidateTryoutSet: mocks.revalidateTryoutSet,
}));

/** Asserts the latest handled server exception scheduling payload. */
function expectScheduledServerException(
  error: Error,
  properties: Record<string, unknown>
) {
  const latestCall =
    mocks.scheduleCurrentServerExceptionCapture.mock.calls.at(-1);

  expect(latestCall).toBeDefined();

  if (!latestCall) {
    return;
  }

  const [capturedError, capturedProperties] = latestCall;

  expect(capturedError).toBeInstanceOf(Error);
  expect(capturedError).toMatchObject({
    message: error.message,
    name: error.name,
  });
  expect(capturedProperties).toEqual(properties);
}

describe("components/tryout/actions/part", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue(undefined);
  });

  it("rejects without touching Convex when start auth is missing", async () => {
    mocks.requireAuth.mockRejectedValue(
      new mocks.AuthenticationRequiredError()
    );

    await expect(
      startTryoutPart({
        locale: "id",
        partKey: "mathematical-reasoning",
        partKeys: ["mathematical-reasoning"],
        product: "snbt",
        tryoutAttemptId,
        tryoutSlug: "2026-set-1",
      })
    ).rejects.toBeInstanceOf(mocks.AuthenticationRequiredError);

    expect(mocks.fetchAuthMutation).not.toHaveBeenCalled();
    expect(mocks.scheduleCurrentServerExceptionCapture).not.toHaveBeenCalled();
  });

  it("rejects without touching Convex when completion auth is missing", async () => {
    mocks.requireAuth.mockRejectedValue(
      new mocks.AuthenticationRequiredError()
    );

    await expect(
      completeTryoutPart({
        locale: "id",
        partKey: "mathematical-reasoning",
        partKeys: ["mathematical-reasoning"],
        product: "snbt",
        tryoutAttemptId,
        tryoutSlug: "2026-set-1",
      })
    ).rejects.toBeInstanceOf(mocks.AuthenticationRequiredError);

    expect(mocks.fetchAuthMutation).not.toHaveBeenCalled();
    expect(mocks.scheduleCurrentServerExceptionCapture).not.toHaveBeenCalled();
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
    expectScheduledServerException(error, {
      locale: "id",
      part_key: "mathematical-reasoning",
      product: "snbt",
      source: "start-tryout-part",
      tryout_attempt_id: "tryoutAttemptId",
      tryout_slug: "2026-set-1",
    });
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
    expectScheduledServerException(error, {
      locale: "id",
      part_key: "mathematical-reasoning",
      product: "snbt",
      source: "complete-tryout-part",
      tryout_attempt_id: tryoutAttemptId,
      tryout_slug: "2026-set-1",
    });
  });
});
