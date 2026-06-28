import { vi } from "vitest";

const TEST_API_KEY = "test-api-key-12345";

vi.mock("@/env", () => ({
  env: {
    INTERNAL_CONTENT_API_KEY: TEST_API_KEY,
    NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud",
  },
}));
