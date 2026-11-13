import { describe, expect, it } from "@effect/vitest";
import {
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";

describe("public content runtime endpoints", () => {
  it("owns one canonical singular and batch contract", () => {
    expect(PUBLIC_CONTENT_RUNTIME_PATH).toBe("/internal/content/runtime");
    expect(PUBLIC_CONTENT_RUNTIME_BATCH_PATH).toBe(
      "/internal/content/runtime/batch"
    );
  });
});
