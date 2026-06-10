import { describe, expect, it } from "vitest";
import {
  getSearchExcerptParts,
  hasSearchExcerpt,
} from "@/lib/content/search-highlight";

describe("search-highlight", () => {
  it("highlights query tokens without injecting HTML", () => {
    const parts = getSearchExcerptParts(
      "Pelajari fungsi rasional pada kelas 11.",
      "fungsi kelas"
    );

    expect(parts).toEqual([
      { highlighted: false, key: "0:Pelajari ", text: "Pelajari " },
      { highlighted: true, key: "9:fungsi", text: "fungsi" },
      {
        highlighted: false,
        key: "15: rasional pada ",
        text: " rasional pada ",
      },
      { highlighted: true, key: "30:kelas", text: "kelas" },
      { highlighted: false, key: "35: 11.", text: " 11." },
    ]);
  });

  it("returns a single plain part when query has no searchable token", () => {
    expect(getSearchExcerptParts("Tanpa highlight.", "!!!")).toEqual([
      {
        highlighted: false,
        key: "0:Tanpa highlight.",
        text: "Tanpa highlight.",
      },
    ]);
  });

  it("returns a single plain part when searchable tokens do not match", () => {
    expect(getSearchExcerptParts("Tanpa highlight.", "fungsi")).toEqual([
      {
        highlighted: false,
        key: "0:Tanpa highlight.",
        text: "Tanpa highlight.",
      },
    ]);
  });

  it("returns an empty plain part for empty excerpts", () => {
    expect(getSearchExcerptParts("", "fungsi")).toEqual([
      { highlighted: false, key: "0:", text: "" },
    ]);
  });

  it("handles duplicate tokens and excerpts that start with a match", () => {
    expect(getSearchExcerptParts("Fungsi", "fungsi fungsi")).toEqual([
      { highlighted: true, key: "0:Fungsi", text: "Fungsi" },
    ]);
  });

  it("caps highlighted query tokens", () => {
    const parts = getSearchExcerptParts(
      "sembilan satu",
      "satu dua tiga empat lima enam tujuh delapan sembilan"
    );

    expect(parts).toEqual([
      { highlighted: false, key: "0:sembilan ", text: "sembilan " },
      { highlighted: true, key: "9:satu", text: "satu" },
    ]);
  });

  it("detects visible excerpts", () => {
    expect(hasSearchExcerpt("  ")).toBe(false);
    expect(hasSearchExcerpt("Al-Fatihah")).toBe(true);
  });
});
