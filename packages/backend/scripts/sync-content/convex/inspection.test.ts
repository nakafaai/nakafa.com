import { GRAPH_IDENTITY_TARGETS } from "@repo/backend/scripts/sync-content/convex/inspection";
import { describe, expect, it } from "vitest";

describe("sync-content inspection", () => {
  it("includes graph-backed audio tables in the verification target list", () => {
    expect(GRAPH_IDENTITY_TARGETS).toEqual(
      expect.arrayContaining([
        "audioContentSources",
        "audioGenerationQueue",
        "contentAudios",
      ])
    );
  });
});
