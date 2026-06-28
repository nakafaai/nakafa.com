import { afterEach, describe, expect, it, vi } from "vitest";

async function loadProducts() {
  vi.resetModules();
  return await import("@repo/backend/convex/utils/polar/products");
}

const expectedMonthlyPrices = {
  default: {
    amount: 8.99,
    currency: "USD",
    fractionDigits: 2,
    locale: "en-US",
  },
  ID: {
    amount: 69_000,
    currency: "IDR",
    fractionDigits: 0,
    locale: "id-ID",
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("utils/polar/products", () => {
  it("uses sandbox product IDs outside production Polar mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_SERVER", "sandbox");

    const { products } = await loadProducts();

    expect(products.pro).toEqual({
      id: "5435bfd4-ca2a-4f97-ae7b-27d65907e49b",
      monthlyPrices: expectedMonthlyPrices,
      slug: "pro",
    });
  });

  it("uses production product IDs in production Polar mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_POLAR_SERVER", "production");

    const { products } = await loadProducts();

    expect(products.pro).toEqual({
      id: "db602388-ef0c-4a88-92fa-c785f3230c45",
      monthlyPrices: expectedMonthlyPrices,
      slug: "pro",
    });
  });
});
