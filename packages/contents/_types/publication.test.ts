import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import {
  comparePublicationDates,
  normalizePublicationDates,
} from "@repo/contents/_types/publication";
import { describe, expect, it } from "vitest";

const firstPublished = DateOnlySchema.make("2025-06-05");
const laterModified = DateOnlySchema.make("2026-08-22");

describe("normalizePublicationDates", () => {
  it("maps an exact legacy date to the current publication field", () => {
    expect(normalizePublicationDates({ date: firstPublished })).toEqual({
      datePublished: firstPublished,
    });
  });

  it("preserves a publication date without inventing a modification", () => {
    expect(
      normalizePublicationDates({ datePublished: firstPublished })
    ).toEqual({ datePublished: firstPublished });
  });

  it("preserves both current dates when a modification exists", () => {
    expect(
      normalizePublicationDates({
        dateModified: laterModified,
        datePublished: firstPublished,
      })
    ).toEqual({
      dateModified: laterModified,
      datePublished: firstPublished,
    });
  });

  it("normalizes an equal dual-written bridge date", () => {
    expect(
      normalizePublicationDates({
        date: firstPublished,
        dateModified: laterModified,
        datePublished: firstPublished,
      })
    ).toEqual({
      dateModified: laterModified,
      datePublished: firstPublished,
    });
  });

  it("orders mixed transition rows by publication date and content key", () => {
    const rows = [
      { contentKey: "article-b", date: firstPublished },
      { contentKey: "article-a", datePublished: laterModified },
      { contentKey: "article-c", datePublished: laterModified },
    ];

    expect(rows.sort(comparePublicationDates)).toEqual([
      { contentKey: "article-c", datePublished: laterModified },
      { contentKey: "article-a", datePublished: laterModified },
      { contentKey: "article-b", date: firstPublished },
    ]);
  });
});
