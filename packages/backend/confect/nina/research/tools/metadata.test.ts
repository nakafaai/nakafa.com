import { describe, expect, it } from "@effect/vitest";
import {
  firstText,
  getDocumentMetadata,
} from "@repo/backend/confect/nina/research/tools/metadata";

describe("firstText", () => {
  it("returns the first text that is not blank, without the spaces around it", () => {
    expect(firstText(undefined, null, "  ", " Second ", "Third")).toBe(
      "Second"
    );
  });

  it("reads a list of texts as its items in order, and skips an empty one", () => {
    expect(firstText([], ["", "  ", "Item"], "Later")).toBe("Item");
  });

  it("returns nothing when no text is left", () => {
    expect(firstText(undefined, null, "", [" "])).toBeUndefined();
  });
});

describe("getDocumentMetadata", () => {
  it("takes the given texts before the fields of the page", () => {
    expect(
      getDocumentMetadata({
        description: "Given description",
        metadata: {
          description: "Page description",
          favicon: "https://example.com/favicon.ico",
          title: "Page title",
        },
        title: "Given title",
      })
    ).toEqual({
      description: "Given description",
      favicon: "https://example.com/favicon.ico",
      title: "Given title",
    });
  });

  it("reads each field of the page as its first usable text, also when the page gives a list", () => {
    expect(
      getDocumentMetadata({
        metadata: {
          description: null,
          favicon: ["", "https://example.com/favicon.ico"],
          ogDescription: ["", "Second description"],
          title: ["First title", "Second title"],
        },
      })
    ).toEqual({
      description: "Second description",
      favicon: "https://example.com/favicon.ico",
      title: "First title",
    });
  });

  it("leaves out what neither the caller nor the page gives", () => {
    expect(getDocumentMetadata({})).toEqual({});
    expect(getDocumentMetadata({ metadata: null })).toEqual({});
  });
});
