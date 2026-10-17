import { beforeEach, describe, expect, it } from "@effect/vitest";
import { NextRequest } from "next/server";
import { routeSchoolRequest } from "@/lib/routing/school/request";

const mockSchool = vi.hoisted(() => ({
  middleware: vi.fn(
    (_request: NextRequest) =>
      new Response(null, { headers: { "x-locale-proxy": "school" } })
  ),
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  schoolRouting: { locales: ["en", "id", "de"] },
}));
vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => mockSchool.middleware),
}));

/**
 * A request as a browser sends it: the Host header names the host of the URL,
 * with the port when the URL has one.
 */
function visit(
  address: string,
  init?: { headers?: HeadersInit; method?: string }
) {
  const url = new URL(address);
  const headers = new Headers(init?.headers);
  headers.set("host", url.host);
  return new NextRequest(url, { headers, method: init?.method ?? "GET" });
}

describe("school requests", () => {
  beforeEach(() => {
    mockSchool.middleware.mockClear();
  });

  it("rewrites a school path into the school tree and keeps the address", () => {
    const response = routeSchoolRequest(
      visit("https://harapan.nakafa.com/classes/fisika-x-1?tab=grades")
    );

    expect(mockSchool.middleware).toHaveBeenCalledOnce();
    const [[rewritten]] = mockSchool.middleware.mock.calls;
    expect(rewritten.nextUrl.href).toBe(
      "https://harapan.nakafa.com/school/harapan/classes/fisika-x-1?tab=grades"
    );
    expect(response?.headers.get("x-robots-tag")).toBe("noindex");
    expect(response?.headers.get("vary")).toContain("Accept-Language");
  });

  it("rewrites the root of a school host to the root of the school tree", () => {
    routeSchoolRequest(visit("https://harapan.nakafa.com/"));

    const [[rewritten]] = mockSchool.middleware.mock.calls;
    expect(rewritten.nextUrl.pathname).toBe("/school/harapan");
  });

  it("hands the NEXT_LOCALE cookie and Accept-Language of the visitor to the locale routing", () => {
    routeSchoolRequest(
      visit("https://harapan.nakafa.com/", {
        headers: { cookie: "NEXT_LOCALE=de", "accept-language": "id-ID" },
      })
    );

    const [[rewritten]] = mockSchool.middleware.mock.calls;
    expect(rewritten.headers.get("cookie")).toBe("NEXT_LOCALE=de");
    expect(rewritten.headers.get("accept-language")).toBe("id-ID");
  });

  it("varies the school response by the cookie and by Accept-Language", () => {
    const response = routeSchoolRequest(visit("https://harapan.nakafa.com/"));

    expect(response?.headers.get("vary")).toContain("Accept-Language");
    expect(response?.headers.get("vary")).toContain("Cookie");
  });

  it("rewrites a local school host the same way as a production one", () => {
    routeSchoolRequest(visit("http://harapan.localhost:3000/"));

    const [[rewritten]] = mockSchool.middleware.mock.calls;
    expect(rewritten.nextUrl.href).toBe(
      "http://harapan.localhost:3000/school/harapan"
    );
  });

  it("reads the school host from the Host header when the URL names localhost", () => {
    const response = routeSchoolRequest(
      new NextRequest("http://localhost:3000/", {
        headers: { host: "harapan.localhost:3000" },
      })
    );

    expect(response?.headers.get("x-robots-tag")).toBe("noindex");
    const [[rewritten]] = mockSchool.middleware.mock.calls;
    expect(rewritten.nextUrl.href).toBe("http://localhost:3000/school/harapan");
  });

  it("sends a refused host to the main site with its path and query, as a 307", () => {
    const response = routeSchoolRequest(
      visit("https://www.nakafa.com/classes/fisika?tab=grades")
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "https://nakafa.com/classes/fisika?tab=grades"
    );
    expect(mockSchool.middleware).not.toHaveBeenCalled();
  });

  it("sends a refused host to the production origin when the request URL names localhost", () => {
    const response = routeSchoolRequest(
      new NextRequest("http://localhost:3400/classes/fisika?tab=grades", {
        headers: { host: "www.nakafa.com:3400" },
      })
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "https://nakafa.com/classes/fisika?tab=grades"
    );
    expect(mockSchool.middleware).not.toHaveBeenCalled();
  });

  it("keeps the refused redirect on the main site when the path starts with two slashes", () => {
    const response = routeSchoolRequest(
      visit("https://www.nakafa.com//example.org/classes")
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "https://nakafa.com//example.org/classes"
    );
  });

  it.each([
    "https://nakafa.com/school/harapan",
    "https://nakafa.com/id/school/harapan",
  ])(
    "answers the school tree with a plain 404 on the main host: %s",
    async (address) => {
      const response = routeSchoolRequest(visit(address));

      expect(response?.status).toBe(404);
      expect(response?.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8"
      );
      expect(response?.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response?.text()).toBe("Not Found\n");
      expect(mockSchool.middleware).not.toHaveBeenCalled();
    }
  );

  it("answers an encoded school path with 404 on the main host", () => {
    const response = routeSchoolRequest(
      visit("https://nakafa.com/id/%73chool/harapan")
    );

    expect(response?.status).toBe(404);
    expect(mockSchool.middleware).not.toHaveBeenCalled();
  });

  it("answers an encoded school path with 404 to a Flight request and to a POST", () => {
    const flight = routeSchoolRequest(
      visit("https://nakafa.com/id/%73chool/harapan", {
        headers: { rsc: "1" },
      })
    );
    const post = routeSchoolRequest(
      visit("https://nakafa.com/id/%73chool/harapan", {
        method: "POST",
      })
    );

    expect(flight?.status).toBe(404);
    expect(post?.status).toBe(404);
    expect(mockSchool.middleware).not.toHaveBeenCalled();
  });

  it("leaves a bypass file of a school host to the public routes", () => {
    const response = routeSchoolRequest(
      visit("https://harapan.nakafa.com/robots.txt")
    );

    expect(response).toBeNull();
    expect(mockSchool.middleware).not.toHaveBeenCalled();
  });

  it("leaves a page of the main site to the public routes", () => {
    const response = routeSchoolRequest(visit("https://nakafa.com/en/classes"));

    expect(response).toBeNull();
    expect(mockSchool.middleware).not.toHaveBeenCalled();
  });
});
