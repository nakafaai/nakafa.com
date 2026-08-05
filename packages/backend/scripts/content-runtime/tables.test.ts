import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import routeSchema from "@repo/backend/convex/contents/schema/routes";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content-runtime/tables";
import { describe, expect, it } from "vitest";

describe("content runtime tables", () => {
  it("derives the complete copy set and applies the active pointer last", () => {
    const releaseTables = Object.keys(contentReleaseSchema).filter(
      (table) => table !== "contentState"
    );
    const expected = [
      ...releaseTables,
      ...Object.keys(routeSchema),
      "contentState",
    ];

    expect(CONTENT_RUNTIME_TABLES).toEqual(expected);
    expect(new Set(CONTENT_RUNTIME_TABLES).size).toBe(expected.length);
  });
});
