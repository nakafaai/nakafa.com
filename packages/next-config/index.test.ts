import {
  config,
  createSecurityHeaders,
  securityHeaders,
  withAnalyzer,
  withMDX,
} from "@repo/next-config";
import { getAppUrl } from "@repo/next-config/app";
import { keys } from "@repo/next-config/keys";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@next/bundle-analyzer", () => ({
  default: () => (sourceConfig: object) => ({
    ...sourceConfig,
    analyzerEnabled: true,
  }),
}));

vi.mock("@next/mdx", () => ({
  default: (mdxConfig: object) => (sourceConfig: object) => ({
    ...sourceConfig,
    mdxConfig,
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSecurityHeaders", () => {
  it("builds the default CSP header", () => {
    const csp = createSecurityHeaders().find(
      (header) => header.key === "Content-Security-Policy"
    );

    expect(csp?.value).toContain("script-src 'self'");
    expect(csp?.value).toContain("connect-src 'self'");
    expect(csp?.value).not.toContain("posthog.com");
  });

  it("exposes shared headers through the Next config", async () => {
    const headers = config.headers;

    if (!headers) {
      throw new Error("Expected shared Next config headers.");
    }

    const headerConfig = await headers();

    expect(headerConfig).toStrictEqual([
      {
        headers: securityHeaders,
        source: "/:path*",
      },
    ]);
  });

  it("composes analyzer and MDX config helpers", () => {
    expect(withAnalyzer({ reactStrictMode: true })).toMatchObject({
      analyzerEnabled: true,
      reactStrictMode: true,
    });
    expect(withMDX({ reactStrictMode: true })).toMatchObject({
      mdxConfig: {
        options: {
          remarkPlugins: [
            "remark-gfm",
            ["remark-math", { singleDollarTextMath: false }],
          ],
        },
      },
      reactStrictMode: true,
    });
  });

  it("reads the configured public app URL", () => {
    vi.stubEnv("INTERNAL_CONTENT_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    vi.stubEnv("NEXT_PUBLIC_MCP_URL", "https://mcp.example.com");
    vi.stubEnv("NEXT_PUBLIC_VERSION", "test-version");

    expect(getAppUrl()).toBe("https://example.com");
  });

  it("rejects missing public app URLs", () => {
    expect(() => getAppUrl()).toThrow("NEXT_PUBLIC_APP_URL is required.");
  });

  it("rejects invalid required public URLs", () => {
    vi.stubEnv("INTERNAL_CONTENT_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_MCP_URL", "https://mcp.example.com");
    vi.stubEnv("NEXT_PUBLIC_VERSION", "test-version");

    expect(() => keys()).toThrow("Invalid environment variables");
  });

  it("rejects invalid optional public URLs when present", () => {
    vi.stubEnv("INTERNAL_CONTENT_API_KEY", "test-key");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com");
    vi.stubEnv("NEXT_PUBLIC_MCP_URL", "https://mcp.example.com");
    vi.stubEnv("NEXT_PUBLIC_VERSION", "test-version");

    expect(() => keys()).toThrow("Invalid environment variables");
  });
});
