// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { readConvexClient } from "@/lib/convex/client";

const URL = "https://example.convex.cloud";

describe("browser Convex client", () => {
  it("creates one client per page", () => {
    expect(readConvexClient(URL)).toBe(readConvexClient(URL));
  });
});
