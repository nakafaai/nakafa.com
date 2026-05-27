import { primaryTryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { locales } from "@repo/utilities/locales";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startTryout } from "@/components/tryout/actions/tryout";

const testLocale = locales[1];
const tryoutSlug = "2026-set-1";
const tryoutReturnPath = `/${testLocale}/try-out/${primaryTryoutProduct}/${tryoutSlug}`;
const tryoutPartKeys = ["quantitative-knowledge"] as const;

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

vi.mock("@repo/backend/confect/modules/commerce/polar/products", () => ({
  getProductsForServer: () => ({ pro: { id: "pro-product-id" } }),
}));

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_POLAR_SERVER: "sandbox",
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
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      returnPath: tryoutReturnPath,
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

  it("creates a checkout url when the backend requires access", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });
    mocks.fetchAuthAction.mockResolvedValue({
      url: "https://checkout.example/session",
    });

    const result = await startTryout({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      returnPath: tryoutReturnPath,
      tryoutSlug,
    });

    expect(result).toEqual({
      kind: "requires-access",
      url: "https://checkout.example/session",
    });
    expect(mocks.fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      productIds: ["pro-product-id"],
      successUrl: `https://nakafa.com${tryoutReturnPath}`,
    });
  });

  it("returns unknown when checkout creation cannot build a safe return url", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });

    const result = await startTryout({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      returnPath: "https://evil.example/redirect",
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.fetchAuthAction).not.toHaveBeenCalled();
  });

  it("captures checkout generation failures", async () => {
    const error = new Error("checkout boom");
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "requires-access" });
    mocks.fetchAuthAction.mockRejectedValue(error);

    const result = await startTryout({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      returnPath: tryoutReturnPath,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        source: "tryout-checkout-url",
        success_url: `https://nakafa.com${tryoutReturnPath}`,
      }
    );
  });

  it("returns explicit not-ready results without revalidation", async () => {
    mocks.fetchAuthMutation.mockResolvedValue({ kind: "not-ready" });

    const result = await startTryout({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      returnPath: tryoutReturnPath,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "not-ready" });
    expect(mocks.revalidateTryoutOverview).not.toHaveBeenCalled();
    expect(mocks.revalidateTryoutSet).not.toHaveBeenCalled();
  });

  it("captures unexpected backend failures", async () => {
    const error = new Error("boom");
    mocks.fetchAuthMutation.mockRejectedValue(error);

    const result = await startTryout({
      locale: testLocale,
      partKeys: tryoutPartKeys,
      product: primaryTryoutProduct,
      returnPath: tryoutReturnPath,
      tryoutSlug,
    });

    expect(result).toEqual({ kind: "unknown" });
    expect(mocks.captureServerException).toHaveBeenCalledWith(
      error,
      "user_123",
      {
        locale: testLocale,
        product: primaryTryoutProduct,
        source: "start-tryout",
        tryout_slug: tryoutSlug,
      }
    );
  });
});
