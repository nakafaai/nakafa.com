import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProCheckoutUrl } from "@/components/checkout/actions";

const mocks = vi.hoisted(() => ({
  fetchAuthAction: vi.fn(),
  headers: vi.fn(),
  ipAddress: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  fetchAuthAction: mocks.fetchAuthAction,
  requireAuth: mocks.requireAuth,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@vercel/functions", () => ({
  ipAddress: mocks.ipAddress,
}));

vi.mock("@repo/backend/convex/utils/polar/products", () => ({
  products: {
    pro: {
      id: "pro-product-id",
    },
  },
}));

describe("components/checkout/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchAuthAction.mockResolvedValue({
      url: "https://checkout.example/session",
    });
    mocks.headers.mockResolvedValue(new Headers());
    mocks.ipAddress.mockReturnValue("203.0.113.10");
    mocks.requireAuth.mockResolvedValue(undefined);
  });

  it("creates checkout from the request IP address", async () => {
    const requestHeaders = new Headers();
    mocks.headers.mockResolvedValue(requestHeaders);

    const url = await createProCheckoutUrl({
      locale: "id",
      successUrl: "https://nakafa.com/id/#pricing",
    });

    expect(url).toBe("https://checkout.example/session");
    expect(mocks.requireAuth).toHaveBeenCalledOnce();
    expect(mocks.ipAddress).toHaveBeenCalledWith(requestHeaders);
    expect(mocks.fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      customerIpAddress: "203.0.113.10",
      locale: "id",
      productIds: ["pro-product-id"],
      successUrl: "https://nakafa.com/id/#pricing",
    });
  });

  it("passes null when Vercel has no request IP header", async () => {
    mocks.ipAddress.mockReturnValue(undefined);

    await createProCheckoutUrl({
      locale: "en",
      successUrl: "https://nakafa.com/en/#pricing",
    });

    expect(mocks.fetchAuthAction).toHaveBeenCalledWith(expect.anything(), {
      customerIpAddress: null,
      locale: "en",
      productIds: ["pro-product-id"],
      successUrl: "https://nakafa.com/en/#pricing",
    });
  });
});
