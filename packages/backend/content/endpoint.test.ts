import { describe, expect, it } from "@effect/vitest";
import {
  PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH,
  PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
  PROTECTED_CONTENT_RUNTIME_PATH,
  RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";

describe("protected content runtime endpoints", () => {
  it("keeps predecessor and permanent contracts on disjoint paths", () => {
    expect(PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH).toBe(
      "/internal/content/runtime/protected"
    );
    expect(PROTECTED_CONTENT_RUNTIME_PATH).toBe(
      "/internal/content/runtime/v2/protected"
    );
    expect(PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH).toBe(
      "/internal/content/runtime/protected/history"
    );
    expect(RETAINED_PROTECTED_CONTENT_RUNTIME_PATH).toBe(
      "/internal/content/runtime/v2/protected/history"
    );
  });
});
