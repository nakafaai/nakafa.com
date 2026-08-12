// @vitest-environment node

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const CONVEX_SITE_URL = "https://test.convex.site";

let handler: typeof import("./server")["handler"];

beforeAll(async () => {
  vi.stubEnv("INTERNAL_CONTENT_API_KEY", "test-content-key");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", CONVEX_SITE_URL);
  vi.stubEnv("NEXT_PUBLIC_MCP_URL", "https://test.example.com/mcp");
  vi.stubEnv("SITE_URL", "https://nakafa.com");

  ({ handler } = await import("./server"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("Better Auth server proxy", () => {
  it("keeps the public host out of Convex ingress routing", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const request = new Request("https://nakafa.com/api/auth/sign-in/social", {
      body: "{}",
      headers: { "x-forwarded-host": "proxy.internal.example.com" },
      method: "POST",
    });

    const response = await handler.POST(request);
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${CONVEX_SITE_URL}/api/auth/sign-in/social`
    );
    expect(headers.get("host")).toBe("test.convex.site");
    expect(headers.get("x-forwarded-host")).toBeNull();
    expect(headers.get("x-forwarded-proto")).toBe("https");
    expect(headers.get("x-better-auth-forwarded-host")).toBe("nakafa.com");
    expect(headers.get("x-better-auth-forwarded-proto")).toBe("https");
  });

  it("reads the current Better Auth token through the server boundary", async () => {
    const componentGetToken = vi.fn().mockResolvedValue("test-token");

    vi.resetModules();
    vi.doMock("@convex-dev/better-auth/nextjs", () => ({
      convexBetterAuthNextJs: () => ({
        fetchAuthQuery: vi.fn(),
        getToken: componentGetToken,
        handler: { GET: vi.fn(), POST: vi.fn() },
        preloadAuthQuery: vi.fn(),
      }),
    }));

    const { getToken } = await import("./server");

    await expect(getToken()).resolves.toBe("test-token");
    expect(componentGetToken).toHaveBeenCalledOnce();

    vi.doUnmock("@convex-dev/better-auth/nextjs");
  });
});
