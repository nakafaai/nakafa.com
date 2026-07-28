import {
  getHashBucket,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { describe, expect, it } from "vitest";

describe("contentRelease/bucket", () => {
  it("derives only canonical SHA-256 hash buckets", () => {
    expect(getHashBucket(`sha256:${"a".repeat(64)}`)).toBe("aaa");
    expect(getHashBucket("digest")).toBeNull();
    expect(getHashBucket("sha256:no")).toBeNull();
    expect(isProjectionBucket("09f")).toBe(true);
    expect(isProjectionBucket("09F")).toBe(false);
  });
});
