import { beforeEach, describe, expect, it, vi } from "vitest";
import { startTryout } from "./tryout";

const mocks = vi.hoisted(() => ({
  after: vi.fn(async (callback) => await callback()),
  captureServerException: vi.fn(),
  cookies: vi.fn(),
  extractDistinctIdFromPostHogCookie: vi.fn(),
  fetchAuthAction: vi.fn(),
  fetchAuthMutation: vi.fn(),
  getPathname: vi.fn(),
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
  fetchAuthAction: mocks.fetchAuthAction,
  fetchAuthMutation: mocks.fetchAuthMutation,
}));

vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: mocks.getPathname,
}));

vi.mock("@/components/tryout/actions/revalidate", () => ({
  revalidateTryoutOverview: mocks.revalidateTryoutOverview,
  revalidateTryoutSet: mocks.revalidateTryoutSet,
}));

vi.mock("@repo/backend/convex/utils/polar/products", () => ({
  products: {
    pro: {
      id: "pro-product-id",
    },
  },
}));

vi.mock("@/env", () => ({
  env: {
    SITE_URL: "https://nakafa.com",
  },
}));

describe("components/tryout/actions/tryout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      toString: () => "ph_cookie=user_123",
    });
    mocks.extractDistinctIdFromPostHogCookie.mockReturnValue("user_123");
    mocks.getPathname.mockImplementation((args) => args.href);
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
    mocks.fetchAuthAction.mockResolvedValue({
      url: "https://checkout.example/session",
    });

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
    expect(mocks.fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      productIds: ["pro-product-id"],
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
    expect(mocks.fetchAuthAction).not.toHaveBeenCalled();
  });

  it("captures checkout generation failures", async () => {
    const error = new Error("checkout boom");
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });
    mocks.fetchAuthAction.mockRejectedValue(error);

    const result = await startTryout({
      locale: "id",
      partKeys: ["quantitative-knowledge"],
      product: "snbt",
      returnPath: "/id/try-out/snbt/2026-set-1",
      tryoutSlug: "2026-set-1",
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        source: "tryout-checkout-url",
        success_url: "https://nakafa.com/id/try-out/snbt/2026-set-1",
      }
    );
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
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        locale: "id",
        product: "snbt",
        source: "start-tryout",
        tryout_slug: "2026-set-1",
      }
    );
  });
});
