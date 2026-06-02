import { ContentMetadataSchema } from "@repo/contents/_types/content";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("content schemas", () => {
  it("reports the authored date format contract", () => {
    const result = Schema.decodeUnknownEither(ContentMetadataSchema)({
      title: "Broken Date",
      description: "Broken Date Description",
      authors: [{ name: "Author" }],
      date: "2024-01-01",
    });

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(result.left.message).toContain(
        "Invalid content date. Expected MM/DD/YYYY."
      );
    }
  });
});
