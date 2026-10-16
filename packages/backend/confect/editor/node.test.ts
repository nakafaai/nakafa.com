import { describe, expect, it } from "@effect/vitest";
import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { fitsDocument, fitsSlice } from "@repo/backend/confect/editor/node";
import { nested } from "@repo/backend/test/editor/nodes";

describe("editor/node depth", () => {
  it("accepts a document exactly MAX_DOCUMENT_DEPTH node levels deep", () => {
    expect(fitsDocument(nested(MAX_DOCUMENT_DEPTH))).toBe(true);
  });

  it("refuses a document one node level deeper than the bound", () => {
    expect(fitsDocument(nested(MAX_DOCUMENT_DEPTH + 1))).toBe(false);
  });

  it("refuses a deep input without reading it past the bound", () => {
    expect(fitsDocument(nested(100_000))).toBe(false);
  });

  it("holds each node of a slice to the same depth", () => {
    expect(fitsSlice({ content: [nested(MAX_DOCUMENT_DEPTH)] })).toBe(true);
    expect(fitsSlice({ content: [nested(MAX_DOCUMENT_DEPTH + 1)] })).toBe(
      false
    );
  });

  it("leaves a shape it does not read to the schema", () => {
    expect(fitsDocument(7)).toBe(true);
    expect(fitsDocument({ content: "not a list", type: "doc" })).toBe(true);
  });
});
