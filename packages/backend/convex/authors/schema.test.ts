import { describe, expect, it } from "vitest";
import { contentAuthorContentIdValidator } from "./schema";

describe("content author schema", () => {
  it("retains the exact deployed content ID union until the table is drained", () => {
    expect(contentAuthorContentIdValidator.kind).toBe("union");
    expect(contentAuthorContentIdValidator.isOptional).toBe("required");
    expect(
      contentAuthorContentIdValidator.members.map((member) => ({
        kind: member.kind,
        optional: member.isOptional,
        table: member.tableName,
      }))
    ).toEqual([
      { kind: "id", optional: "required", table: "articleContents" },
      { kind: "id", optional: "required", table: "curriculumLessons" },
    ]);
  });
});
