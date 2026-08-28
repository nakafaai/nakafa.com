import { describe, expect, it } from "@effect/vitest";
import {
  PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH,
  PREDECESSOR_RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
  PROTECTED_CONTENT_RUNTIME_PATH,
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_PATH,
  RETAINED_PROTECTED_CONTENT_RUNTIME_PATH,
  TRANSITION_PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  TRANSITION_PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";

describe("public content runtime endpoints", () => {
  it("expands the canonical contract before controlled clients switch", () => {
    expect(PUBLIC_CONTENT_RUNTIME_PATH).toBe("/internal/content/runtime");
    expect(PUBLIC_CONTENT_RUNTIME_BATCH_PATH).toBe(
      "/internal/content/runtime/batch"
    );
    expect(TRANSITION_PUBLIC_CONTENT_RUNTIME_PATH).toBe(
      "/internal/content/runtime/v2"
    );
    expect(TRANSITION_PUBLIC_CONTENT_RUNTIME_BATCH_PATH).toBe(
      "/internal/content/runtime/v2/batch"
    );
  });
});

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
