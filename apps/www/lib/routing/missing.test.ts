import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NextRequest } from "next/server";
import { readMissingLocale } from "@/lib/routing/missing";

const mockLocaleRouting = vi.hoisted(() => ({
  middleware: vi.fn(
    (_request: NextRequest) =>
      new Response(null, { headers: { "x-locale-proxy": "1" } })
  ),
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: { defaultLocale: "en", locales: ["en", "id", "de"] },
}));
vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => mockLocaleRouting.middleware),
}));

/** A request for one address, as the proxy receives it. */
function visit(address: string) {
  return new NextRequest(address);
}

describe("the locale of a missing page", () => {
  beforeEach(() => {
    mockLocaleRouting.middleware.mockClear();
  });

  it("is the locale that the path names, without asking the routing", () => {
    expect(
      readMissingLocale(visit("https://nakafa.com/id/school/harapan"))
    ).toBe("id");
    expect(mockLocaleRouting.middleware).not.toHaveBeenCalled();
  });

  it("decodes the locale that the path names as the routing does", () => {
    expect(readMissingLocale(visit("https://nakafa.com/%69d/school"))).toBe(
      "id"
    );
  });

  it("is the locale of the page that the routing rewrites a path to", () => {
    mockLocaleRouting.middleware.mockReturnValueOnce(
      new Response(null, {
        headers: {
          "x-middleware-rewrite": "https://nakafa.com/de/school/harapan",
        },
      })
    );

    expect(readMissingLocale(visit("https://nakafa.com/school/harapan"))).toBe(
      "de"
    );
  });

  it("is the locale of the path that the routing redirects the visitor to", () => {
    mockLocaleRouting.middleware.mockReturnValueOnce(
      Response.redirect("https://nakafa.com/id/school/harapan", 307)
    );

    expect(readMissingLocale(visit("https://nakafa.com/school/harapan"))).toBe(
      "id"
    );
  });

  it("is the default locale for a path that the routing passes on without a locale", () => {
    mockLocaleRouting.middleware.mockReturnValueOnce(
      new Response(null, { headers: { "x-middleware-next": "1" } })
    );

    expect(readMissingLocale(visit("https://nakafa.com/%/school"))).toBe("en");
  });
});
