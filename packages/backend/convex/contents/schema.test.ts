import { describe, expect, it } from "vitest";
import { contentSearchDocumentValidator } from "./helpers/search/schema";
import tables from "./schema";

describe("content schema", () => {
  it("keeps legacy search rows exact while current results may omit Markdown", () => {
    expect(contentSearchDocumentValidator.fields.markdown_url.isOptional).toBe(
      "optional"
    );
    expect(tables.contentSearch.validator.fields.markdown_url.isOptional).toBe(
      "required"
    );
  });
});
