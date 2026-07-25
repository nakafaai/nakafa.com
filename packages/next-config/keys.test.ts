import {
  analyzeKeys,
  contentApiKeys,
  contentRuntimeKeys,
  keys,
  mcpKeys,
  publicAppKeys,
  siteUrlKeys,
} from "@repo/next-config/keys";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Installs one complete, valid shared Next environment for each test. */
function stubValidEnvironment() {
  vi.stubEnv("ANALYZE", "false");
  vi.stubEnv("CONTENT_RUNTIME_TOKEN", "runtime-token");
  vi.stubEnv("INTERNAL_CONTENT_API_KEY", "cache-token");
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.nakafa.com");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nakafa.com");
  vi.stubEnv("NEXT_PUBLIC_MCP_URL", "https://mcp.nakafa.com");
  vi.stubEnv("NEXT_PUBLIC_VERSION", "test-version");
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("SITE_URL", "https://nakafa.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("shared Next environment keys", () => {
  it("decodes every capability from one complete environment", () => {
    stubValidEnvironment();

    expect(analyzeKeys()).toMatchObject({ ANALYZE: "false" });
    expect(contentApiKeys()).toMatchObject({
      INTERNAL_CONTENT_API_KEY: "cache-token",
    });
    expect(contentRuntimeKeys()).toMatchObject({
      CONTENT_RUNTIME_TOKEN: "runtime-token",
    });
    expect(siteUrlKeys()).toMatchObject({ SITE_URL: "https://nakafa.com" });
    expect(mcpKeys()).toMatchObject({
      NEXT_PUBLIC_MCP_URL: "https://mcp.nakafa.com",
    });
    expect(publicAppKeys()).toMatchObject({
      NEXT_PUBLIC_API_URL: "https://api.nakafa.com",
      NEXT_PUBLIC_APP_URL: "https://nakafa.com",
      NEXT_PUBLIC_VERSION: "test-version",
    });
    expect(keys()).toMatchObject({ NEXT_RUNTIME: "nodejs" });
  });

  it("rejects invalid required and optional URLs", () => {
    stubValidEnvironment();
    vi.stubEnv("SITE_URL", "not-a-url");
    expect(siteUrlKeys).toThrow();

    vi.stubEnv("SITE_URL", "https://nakafa.com");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not-a-url");
    expect(publicAppKeys).toThrow();
  });

  it("requires the executable-content values independently", () => {
    stubValidEnvironment();
    vi.stubEnv("CONTENT_RUNTIME_TOKEN", "");

    expect(contentRuntimeKeys).toThrow();

    vi.stubEnv("CONTENT_RUNTIME_TOKEN", "runtime-token");
    expect(contentRuntimeKeys()).toMatchObject({
      CONTENT_RUNTIME_TOKEN: "runtime-token",
    });
  });
});
