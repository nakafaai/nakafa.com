import { ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY } from "@repo/analytics/consent";
import {
  disableBrowserAnalytics,
  resetBrowserAnalyticsIdentity,
} from "@repo/analytics/posthog/browser";
import { beforeEach, describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";
import { authClient } from "@/lib/auth/client";
import {
  AccountSignOutFailed,
  clearAccountBrowserIdentity,
  clearDeletedAccountBrowserIdentity,
  signOutAccountBrowserIdentity,
} from "@/lib/auth/identity/browser";

vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock("@repo/analytics/posthog/browser", () => ({
  disableBrowserAnalytics: vi.fn(() => Effect.void),
  resetBrowserAnalyticsIdentity: vi.fn(),
}));

describe("account browser identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it.live("clears browser identity without stopping analytics", () =>
    Effect.gen(function* () {
      const removePersistedAccountState = vi.fn();
      const resetAnalytics = vi.fn();

      yield* clearAccountBrowserIdentity({
        removePersistedAccountState,
        resetAnalytics,
      });

      expect(removePersistedAccountState).toHaveBeenCalledOnce();
      expect(resetAnalytics).toHaveBeenCalledOnce();
    })
  );

  it.live(
    "clears account state while preserving the anonymous privacy choice",
    () =>
      Effect.gen(function* () {
        window.localStorage.setItem("nakafa-ai", "test-ai-state");
        window.localStorage.setItem(
          "nakafa-content-views",
          "test-content-view-state"
        );
        window.localStorage.setItem("nakafa-device-id", "test-device");
        window.localStorage.setItem("nakafa-school-layout", "test-layout");
        window.localStorage.setItem(
          ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY,
          "anonymous-privacy-choice"
        );
        window.localStorage.setItem("unrelated", "preserved");
        window.sessionStorage.setItem("nakafa-search", "test-search");
        window.sessionStorage.setItem(
          "nakafa-forum-session:class-1",
          "test-forum-session"
        );
        window.sessionStorage.setItem("unrelated", "preserved");

        yield* clearAccountBrowserIdentity();

        expect(disableBrowserAnalytics).not.toHaveBeenCalled();
        expect(resetBrowserAnalyticsIdentity).toHaveBeenCalledWith(true);
        expect(window.localStorage.getItem("nakafa-ai")).toBeNull();
        expect(window.localStorage.getItem("nakafa-content-views")).toBeNull();
        expect(window.localStorage.getItem("nakafa-device-id")).toBeNull();
        expect(window.localStorage.getItem("nakafa-school-layout")).toBeNull();
        expect(
          window.localStorage.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)
        ).toBe("anonymous-privacy-choice");
        expect(window.localStorage.getItem("unrelated")).toBe("preserved");
        expect(window.sessionStorage.getItem("nakafa-search")).toBeNull();
        expect(
          window.sessionStorage.getItem("nakafa-forum-session:class-1")
        ).toBeNull();
        expect(window.sessionStorage.getItem("unrelated")).toBe("preserved");
      })
  );

  it.live("disables analytics before clearing a deleted browser identity", () =>
    Effect.gen(function* () {
      const denyAnonymousAnalytics = vi.fn(() => Effect.void);
      const disableAnalytics = vi.fn(() => Effect.void);
      const removePersistedAccountState = vi.fn();
      const resetAnalytics = vi.fn();

      yield* clearDeletedAccountBrowserIdentity({
        denyAnonymousAnalytics,
        disableAnalytics,
        removePersistedAccountState,
        resetAnalytics,
      });

      expect(disableAnalytics).toHaveBeenCalledOnce();
      expect(denyAnonymousAnalytics).toHaveBeenCalledOnce();
      expect(removePersistedAccountState).toHaveBeenCalledOnce();
      expect(resetAnalytics).toHaveBeenCalledOnce();
      expect(disableAnalytics.mock.invocationCallOrder[0]).toBeLessThan(
        denyAnonymousAnalytics.mock.invocationCallOrder[0] ?? 0
      );
      expect(denyAnonymousAnalytics.mock.invocationCallOrder[0]).toBeLessThan(
        resetAnalytics.mock.invocationCallOrder[0] ?? 0
      );
    })
  );

  it.live("denies anonymous analytics after a committed deletion", () =>
    Effect.gen(function* () {
      yield* clearDeletedAccountBrowserIdentity();

      expect(disableBrowserAnalytics).toHaveBeenCalledOnce();
      expect(resetBrowserAnalyticsIdentity).toHaveBeenCalledWith(true);
      expect(
        window.localStorage.getItem(ANONYMOUS_ANALYTICS_CONSENT_STORAGE_KEY)
      ).toContain('"decision":"denied"');
    })
  );

  it.live("does not fail a completed deletion when browser cleanup fails", () =>
    Effect.gen(function* () {
      expect(
        yield* clearDeletedAccountBrowserIdentity({
          denyAnonymousAnalytics: () =>
            Effect.fail("privacy storage unavailable"),
          disableAnalytics: () => Effect.fail("analytics queue unavailable"),
          removePersistedAccountState: () => {
            throw new Error("storage unavailable");
          },
          resetAnalytics: () => {
            throw new Error("analytics unavailable");
          },
        })
      ).toBeUndefined();
    })
  );

  it.live("clears browser identity after successful sign-out", () =>
    Effect.gen(function* () {
      vi.mocked(authClient.signOut).mockResolvedValue({
        data: { success: true },
        error: null,
      });
      window.localStorage.setItem("nakafa-ai", "deleted-account-chat");
      window.sessionStorage.setItem(
        "nakafa-forum-session:class-1",
        "deleted-account-forum"
      );

      expect(yield* signOutAccountBrowserIdentity()).toBeUndefined();

      expect(window.localStorage.getItem("nakafa-ai")).toBeNull();
      expect(
        window.sessionStorage.getItem("nakafa-forum-session:class-1")
      ).toBeNull();
      expect(disableBrowserAnalytics).not.toHaveBeenCalled();
      expect(resetBrowserAnalyticsIdentity).toHaveBeenCalledWith(true);
      expect(authClient.signOut).toHaveBeenCalledOnce();
      expect(
        vi.mocked(authClient.signOut).mock.invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(resetBrowserAnalyticsIdentity).mock.invocationCallOrder[0] ??
          0
      );
    })
  );

  it.live("preserves browser identity when sign-out is rejected", () =>
    Effect.gen(function* () {
      window.localStorage.setItem("nakafa-ai", "active-account-chat");

      const failure = yield* signOutAccountBrowserIdentity(async () => ({
        data: null,
        error: {
          code: "SIGN_OUT_FAILED",
          message: "Sign-out failed",
          status: 500,
          statusText: "INTERNAL_SERVER_ERROR",
        },
      })).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(AccountSignOutFailed);
      expect(window.localStorage.getItem("nakafa-ai")).toBe(
        "active-account-chat"
      );
      expect(resetBrowserAnalyticsIdentity).not.toHaveBeenCalled();
    })
  );

  it.live("preserves browser identity when sign-out cannot start", () =>
    Effect.gen(function* () {
      window.sessionStorage.setItem(
        "nakafa-forum-session:class-1",
        "active-account-forum"
      );

      const failure = yield* signOutAccountBrowserIdentity(() =>
        Promise.reject(new Error("network unavailable"))
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(AccountSignOutFailed);
      expect(
        window.sessionStorage.getItem("nakafa-forum-session:class-1")
      ).toBe("active-account-forum");
      expect(resetBrowserAnalyticsIdentity).not.toHaveBeenCalled();
    })
  );
});
