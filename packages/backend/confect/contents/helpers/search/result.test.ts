import { describe, expect, it } from "@effect/vitest";
import type { ContentSearchDocument } from "@repo/backend/confect/contents/helpers/search/groups";
import { buildContentSearchResult } from "@repo/backend/confect/contents/helpers/search/result";
import { Array as Arr } from "effect";

/** Builds one ranked search document whose title names its position. */
function createDocument(title: string): ContentSearchDocument {
  return {
    alignmentId: "alignment",
    assetId: "asset",
    conceptId: "concept",
    content_id: `content-${title}`,
    contentHash: "hash",
    description: "Description",
    learningObjectId: "object",
    lensId: "lens",
    locale: "en",
    route: `material/${title}`,
    section: "material",
    sourcePath: `source/${title}`,
    syncedAt: 1,
    text: `Text of ${title}.`,
    title,
    url: `https://nakafa.com/en/material/${title}`,
  };
}

const RANKED = Arr.map(["a", "b", "c", "d"], createDocument);

/** Lists the titles of the items one result page returns. */
function titlesOf(
  args: { limit: number; offset: number },
  ranked: readonly ContentSearchDocument[]
) {
  return Arr.map(
    buildContentSearchResult({ ...args, locale: "en" }, ranked, []).items,
    (item) => item.title
  );
}

describe("buildContentSearchResult", () => {
  it("returns the window of whole offset and limit values", () => {
    expect(titlesOf({ limit: 2, offset: 1 }, RANKED)).toEqual(["b", "c"]);
  });

  it("truncates a fractional offset and the end it reaches, as slice did", () => {
    expect(titlesOf({ limit: 1.5, offset: 0.5 }, RANKED)).toEqual(["a", "b"]);
  });

  it("returns no items for an offset past the end of the ranked documents", () => {
    expect(titlesOf({ limit: 2, offset: 10 }, RANKED)).toEqual([]);
  });
});
