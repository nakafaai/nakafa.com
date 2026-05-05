import {
  config,
  createSecurityHeaders,
  securityHeaders,
  withAnalyzer,
  withMDX,
} from "@repo/next-config";
import { describe, expect, it, vi } from "vitest";

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
});
