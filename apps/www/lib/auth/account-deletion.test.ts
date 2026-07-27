import { analytics } from "@repo/analytics/posthog";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDeletionFailed,
  AccountDeletionSessionExpired,
  AccountReauthenticationFailed,
  clearDeletedAccountBrowserIdentity,
  deleteCurrentAccount,
  prepareAccountReauthentication,
} from "@/lib/auth/account-deletion";
import { authClient } from "@/lib/auth/client";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    deleteUser: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("@repo/analytics/posthog", () => ({
  analytics: {
    reset: vi.fn(),
  },
}));

describe("account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes when Better Auth deletes the account", async () => {
    vi.mocked(authClient.deleteUser).mockResolvedValue({
      data: { message: "User deleted", success: true },
      error: null,
    });

    await expect(
      Effect.runPromise(deleteCurrentAccount())
    ).resolves.toBeUndefined();
  });

  it("clears browser identities after deletion", async () => {
    const removeDeviceIdentity = vi.fn();
    const resetAnalytics = vi.fn();

    await Effect.runPromise(
      clearDeletedAccountBrowserIdentity({
        removeDeviceIdentity,
        resetAnalytics,
      })
    );

    expect(removeDeviceIdentity).toHaveBeenCalledOnce();
    expect(resetAnalytics).toHaveBeenCalledOnce();
  });

  it("clears the default analytics and device identities", async () => {
    window.localStorage.setItem("nakafa-device-id", "test-device");

    await Effect.runPromise(clearDeletedAccountBrowserIdentity());

    expect(analytics.reset).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("nakafa-device-id")).toBeNull();
  });

  it("does not fail a completed deletion when browser cleanup fails", async () => {
    await expect(
      Effect.runPromise(
        clearDeletedAccountBrowserIdentity({
          removeDeviceIdentity: () => {
            throw new Error("storage unavailable");
          },
          resetAnalytics: () => {
            throw new Error("analytics unavailable");
          },
        })
      )
    ).resolves.toBeUndefined();
  });

  it("returns a typed stale-session failure", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount(async () => ({
        data: null,
        error: {
          code: "SESSION_EXPIRED",
          message: "Session expired",
          status: 400,
          statusText: "BAD_REQUEST",
        },
      })).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionSessionExpired);
  });

  it("returns a typed failure for other delete errors", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount(async () => ({
        data: null,
        error: {
          code: "DELETE_FAILED",
          message: "Delete failed",
          status: 500,
          statusText: "INTERNAL_SERVER_ERROR",
        },
      })).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
  });

  it("returns a typed failure when deletion cannot start", async () => {
    const failure = await Effect.runPromise(
      deleteCurrentAccount(() =>
        Promise.reject(new Error("network unavailable"))
      ).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(AccountDeletionFailed);
  });

  it("clears the current session before reauthentication", async () => {
    vi.mocked(authClient.signOut).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    await expect(
      Effect.runPromise(prepareAccountReauthentication())
    ).resolves.toBeUndefined();
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
