import { analytics } from "@repo/analytics/posthog";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountReauthenticationFailed,
  clearDeletedAccountBrowserIdentity,
  prepareAccountReauthentication,
} from "@/lib/auth/account-deletion-identity";
import { authClient } from "@/lib/auth/client";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

vi.mock("@repo/analytics/posthog", () => ({
  analytics: {
    reset: vi.fn(),
    shutdown: vi.fn(async () => undefined),
  },
}));

describe("account deletion identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears browser identities after deletion", async () => {
    const flushAnalytics = vi.fn(async () => undefined);
    const removePersistedAccountState = vi.fn();
    const resetAnalytics = vi.fn();

    await Effect.runPromise(
      clearDeletedAccountBrowserIdentity({
        flushAnalytics,
        removePersistedAccountState,
        resetAnalytics,
      })
    );

    expect(flushAnalytics).toHaveBeenCalledOnce();
    expect(removePersistedAccountState).toHaveBeenCalledOnce();
    expect(resetAnalytics).toHaveBeenCalledOnce();
    expect(flushAnalytics.mock.invocationCallOrder[0]).toBeLessThan(
      resetAnalytics.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("clears analytics and every Nakafa-prefixed account store", async () => {
    window.localStorage.setItem("nakafa-ai", "test-ai-state");
    window.localStorage.setItem(
      "nakafa-content-views",
      "test-content-view-state"
    );
    window.localStorage.setItem("nakafa-device-id", "test-device");
    window.localStorage.setItem("nakafa-school-layout", "test-layout");
    window.localStorage.setItem("unrelated", "preserved");
    window.sessionStorage.setItem("nakafa-search", "test-search");
    window.sessionStorage.setItem(
      "nakafa-forum-session:class-1",
      "test-forum-session"
    );
    window.sessionStorage.setItem("unrelated", "preserved");

    await Effect.runPromise(clearDeletedAccountBrowserIdentity());

    expect(analytics.shutdown).toHaveBeenCalledOnce();
    expect(analytics.reset).toHaveBeenCalledWith(true);
    expect(
      vi.mocked(analytics.shutdown).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(analytics.reset).mock.invocationCallOrder[0] ?? 0);
    expect(window.localStorage.getItem("nakafa-ai")).toBeNull();
    expect(window.localStorage.getItem("nakafa-content-views")).toBeNull();
    expect(window.localStorage.getItem("nakafa-device-id")).toBeNull();
    expect(window.localStorage.getItem("nakafa-school-layout")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("preserved");
    expect(window.sessionStorage.getItem("nakafa-search")).toBeNull();
    expect(
      window.sessionStorage.getItem("nakafa-forum-session:class-1")
    ).toBeNull();
    expect(window.sessionStorage.getItem("unrelated")).toBe("preserved");
  });

  it("does not fail a completed deletion when browser cleanup fails", async () => {
    await expect(
      Effect.runPromise(
        clearDeletedAccountBrowserIdentity({
          flushAnalytics: () =>
            Promise.reject(new Error("analytics queue unavailable")),
          removePersistedAccountState: () => {
            throw new Error("storage unavailable");
          },
          resetAnalytics: () => {
            throw new Error("analytics unavailable");
          },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("clears browser identity before reauthentication", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: { success: true },
      error: null,
    });
    window.localStorage.setItem("nakafa-ai", "deleted-account-chat");
    window.sessionStorage.setItem(
      "nakafa-forum-session:class-1",
      "deleted-account-forum"
    );

    await expect(
      Effect.runPromise(prepareAccountReauthentication())
    ).resolves.toBeUndefined();

    expect(window.localStorage.getItem("nakafa-ai")).toBeNull();
    expect(
      window.sessionStorage.getItem("nakafa-forum-session:class-1")
    ).toBeNull();
    expect(analytics.shutdown).toHaveBeenCalledOnce();
    expect(analytics.reset).toHaveBeenCalledWith(true);
    expect(authClient.signOut).toHaveBeenCalledOnce();
    expect(
      vi.mocked(analytics.shutdown).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(authClient.signOut).mock.invocationCallOrder[0] ?? 0
    );
  });

  it("returns a typed failure when sign-out is rejected", async () => {
    const failure = await Effect.runPromise(
      prepareAccountReauthentication(async () => ({
        data: null,
        error: {
          code: "SIGN_OUT_FAILED",
          message: "Sign-out failed",
          status: 500,
          statusText: "INTERNAL_SERVER_ERROR",
        },
      })).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountReauthenticationFailed);
  });

  it("returns a typed failure when sign-out cannot start", async () => {
    const failure = await Effect.runPromise(
      prepareAccountReauthentication(() =>
        Promise.reject(new Error("network unavailable"))
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountReauthenticationFailed);
  });
});
