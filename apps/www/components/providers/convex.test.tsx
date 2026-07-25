import assert from "node:assert/strict";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ObservedAuth {
  /** Resolves the current Convex access token for one auth refresh request. */
  readonly fetchAccessToken: (input: {
    readonly forceRefreshToken: boolean;
  }) => Promise<string | null>;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
}

interface SessionState {
  data: { readonly session: { readonly id: string } } | null;
  isPending: boolean;
}

interface TokenResponse {
  readonly data: { readonly token?: string } | null;
  readonly error: unknown;
}

const auth = vi.hoisted(() => {
  const observed: { current: ObservedAuth | null } = { current: null };
  const session: SessionState = { data: null, isPending: true };
  const token =
    vi.fn<
      (input: {
        readonly fetchOptions: { readonly throw: false };
      }) => Promise<TokenResponse>
    >();
  return { observed, session, token };
});

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud" },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    convex: { token: auth.token },
    useSession: () => auth.session,
  },
}));

vi.mock("convex/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("convex/react")>();
  return {
    ...original,
    /** Captures the adapter state exposed to the real Convex provider. */
    ConvexProviderWithAuth(props: {
      readonly children?: ReactNode;
      /** Produces the current authentication adapter state. */
      readonly useAuth: () => ObservedAuth;
    }) {
      const { children, useAuth } = props;
      auth.observed.current = useAuth();
      return children;
    },
  };
});

import { ConvexProvider } from "@/components/providers/convex";

const roots: Root[] = [];

beforeEach(() => {
  auth.observed.current = null;
  auth.session.data = null;
  auth.session.isPending = true;
  auth.token.mockReset();
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
});

describe("Convex provider", () => {
  it("uses the server token once and deduplicates a fresh token request", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    act(() => {
      root.render(
        <ConvexProvider initialToken="server-token">content</ConvexProvider>
      );
    });

    const authentication = auth.observed.current;
    assert(authentication);
    expect(authentication).toMatchObject({
      isAuthenticated: true,
      isLoading: false,
    });
    await expect(
      authentication.fetchAccessToken({ forceRefreshToken: false })
    ).resolves.toBe("server-token");
    expect(auth.token).not.toHaveBeenCalled();

    auth.token.mockResolvedValue({
      data: { token: "fresh-token" },
      error: null,
    });
    const first = authentication.fetchAccessToken({
      forceRefreshToken: false,
    });
    const second = authentication.fetchAccessToken({
      forceRefreshToken: false,
    });
    expect(second).toBe(first);
    await expect(first).resolves.toBe("fresh-token");
    expect(auth.token).toHaveBeenCalledOnce();
    expect(auth.token).toHaveBeenCalledWith({
      fetchOptions: { throw: false },
    });
  });

  it("fails closed for rejected, missing, and unsuccessful token responses", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    act(() => {
      root.render(<ConvexProvider>content</ConvexProvider>);
    });

    const authentication = auth.observed.current;
    assert(authentication);
    expect(authentication).toMatchObject({
      isAuthenticated: false,
      isLoading: true,
    });

    auth.token.mockRejectedValueOnce(new Error("network"));
    await expect(
      authentication.fetchAccessToken({ forceRefreshToken: true })
    ).resolves.toBeNull();

    auth.token.mockResolvedValueOnce({ data: null, error: "unauthorized" });
    await expect(
      authentication.fetchAccessToken({ forceRefreshToken: false })
    ).resolves.toBeNull();

    auth.token.mockResolvedValueOnce({ data: {}, error: null });
    await expect(
      authentication.fetchAccessToken({ forceRefreshToken: false })
    ).resolves.toBeNull();
  });

  it("drops an old pending request when the Better Auth session changes", async () => {
    let resolveFirst: ((response: TokenResponse) => void) | undefined;
    const firstResponse = new Promise<TokenResponse>((resolve) => {
      resolveFirst = resolve;
    });
    auth.session.data = { session: { id: "session-one" } };
    auth.session.isPending = false;
    auth.token
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce({
        data: { token: "session-two-token" },
        error: null,
      });

    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    act(() => {
      root.render(<ConvexProvider>content</ConvexProvider>);
    });
    const firstAuthentication = auth.observed.current;
    assert(firstAuthentication);
    const oldRequest = firstAuthentication.fetchAccessToken({
      forceRefreshToken: false,
    });

    auth.session.data = { session: { id: "session-two" } };
    act(() => {
      root.render(<ConvexProvider>content</ConvexProvider>);
    });
    const secondAuthentication = auth.observed.current;
    assert(secondAuthentication);
    await expect(
      secondAuthentication.fetchAccessToken({ forceRefreshToken: false })
    ).resolves.toBe("session-two-token");

    assert(resolveFirst);
    resolveFirst({
      data: { token: "session-one-token" },
      error: null,
    });
    await expect(oldRequest).resolves.toBe("session-one-token");
    expect(auth.token).toHaveBeenCalledTimes(2);
  });

  it("clears bootstrap authentication when the session resolves empty", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    act(() => {
      root.render(
        <ConvexProvider initialToken="server-token">content</ConvexProvider>
      );
    });
    expect(auth.observed.current?.isAuthenticated).toBe(true);

    auth.session.isPending = false;
    act(() => {
      root.render(
        <ConvexProvider initialToken="server-token">content</ConvexProvider>
      );
    });
    expect(auth.observed.current).toMatchObject({
      isAuthenticated: false,
      isLoading: false,
    });
  });
});
