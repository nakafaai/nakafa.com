import { vi } from "vitest";

const TEST_API_KEY = "test-api-key-12345";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({
  env: {
    CONTENT_RUNTIME_TOKEN: "test-runtime-token",
    INTERNAL_CONTENT_API_KEY: TEST_API_KEY,
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://test.convex.site",
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
