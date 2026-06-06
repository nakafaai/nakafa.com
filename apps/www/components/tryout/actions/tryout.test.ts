import { beforeEach, describe, expect, it, vi } from "vitest";
import { startTryout } from "@/components/tryout/actions/tryout";

const mocks = vi.hoisted(() => {
  /** Test double for unauthenticated server-action calls. */
  class MockAuthenticationRequiredError extends Error {}

  return {
    AuthenticationRequiredError: MockAuthenticationRequiredError,
    createProCheckoutUrl: vi.fn(),
    fetchAuthMutation: vi.fn(),
    getPathname: vi.fn(),
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

vi.mock("@/components/checkout/actions", () => ({
  createProCheckoutUrl: mocks.createProCheckoutUrl,
}));

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: mocks.getPathname,
}));

vi.mock("@/components/tryout/actions/revalidate", () => ({
  revalidateTryoutOverview: mocks.revalidateTryoutOverview,
  revalidateTryoutSet: mocks.revalidateTryoutSet,
}));

vi.mock("@/env", () => ({
  env: {
    SITE_URL: "https://nakafa.com",
  },
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

describe("components/tryout/actions/tryout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPathname.mockImplementation((args) => args.href);
    mocks.requireAuth.mockResolvedValue(undefined);
  });

  it("rejects without touching Convex when auth is missing", async () => {
    mocks.requireAuth.mockRejectedValue(
      new mocks.AuthenticationRequiredError()
    );

    await expect(
      startTryout({
        locale: "id",
        partKeys: ["quantitative-knowledge"],
        product: "snbt",
        returnPath: "/id/try-out/snbt/2026-set-1",
        tryoutSlug: "2026-set-1",
      })
    ).rejects.toBeInstanceOf(mocks.AuthenticationRequiredError);

    expect(mocks.fetchAuthMutation).not.toHaveBeenCalled();
    expect(mocks.scheduleCurrentServerExceptionCapture).not.toHaveBeenCalled();
  });

  it("revalidates tryout routes after a successful start", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "started" });

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "/id/try-out/snbt/2026-set-1",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "started" });
    expect(mocks.revalidateTryoutOverview).toHaveBeenCalledWith({
      locale: "id",
      product: "snbt",
    });
    expect(mocks.revalidateTryoutSet).toHaveBeenCalledWith({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      tryoutSlug: "2026-set-1",
    });
  });

  it("creates a checkout url when the backend requires access", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });
    mocks.createProCheckoutUrl.mockResolvedValue(
      "https://checkout.example/session"
    );

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "/id/try-out/snbt/2026-set-1",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({
      kind: "requires-access",
      url: "https://checkout.example/session",
    });
    expect(mocks.createProCheckoutUrl).toHaveBeenCalledWith({
      locale: "id",
      successUrl: "https://nakafa.com/id/try-out/snbt/2026-set-1",
    });
  });

  it("returns unknown when checkout creation cannot build a safe return url", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "https://evil.example/redirect",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.createProCheckoutUrl).not.toHaveBeenCalled();
  });

  it("captures checkout generation failures", async () => {
    const error = new Error("checkout boom");
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });
    mocks.createProCheckoutUrl.mockRejectedValue(error);

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "/id/try-out/snbt/2026-set-1",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "unknown" });
    expectScheduledServerException(error, {
      source: "tryout-checkout-url",
      success_url: "https://nakafa.com/id/try-out/snbt/2026-set-1",
    });
  });

  it("returns explicit not-ready results without revalidation", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "not-ready" });

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "/id/try-out/snbt/2026-set-1",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "not-ready" });
    expect(mocks.revalidateTryoutOverview).not.toHaveBeenCalled();
    expect(mocks.revalidateTryoutSet).not.toHaveBeenCalled();
  });

  it("captures unexpected backend failures", async () => {
    const error = new Error("boom");
    mocks.fetchAuthMutation.mockRejectedValue(error);

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "/id/try-out/snbt/2026-set-1",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "unknown" });
    expectScheduledServerException(error, {
      locale: "id",
      product: "snbt",
      source: "start-tryout",
      tryout_slug: "2026-set-1",
    });
  });
});
