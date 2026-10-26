import { describe, expect, it } from "@effect/vitest";
import {
  readPictures,
  wordReads,
} from "@/components/tenant/exams/import/reads";

describe("wordReads", () => {
  it("keeps a short document in one read", () => {
    expect(wordReads(["- Soal satu", "  - A"], 100)).toEqual([
      "- Soal satu\n  - A",
    ]);
    expect(wordReads([], 100)).toEqual([]);
    expect(wordReads(["- Soal satu"])).toEqual(["- Soal satu"]);
  });

  it("ends a read before a numbered question in its second half, so the question stays whole", () => {
    const lines = ["- Soal 1", "  - A", "  - B", "- Soal 2", "  - C", "  - D"];
    expect(wordReads(lines, 33)).toEqual([
      "- Soal 1\n  - A\n  - B",
      "- Soal 2\n  - C\n  - D",
    ]);
  });

  it("ends a read where its length runs out when no question starts in its second half, and gives a long line a read of its own", () => {
    expect(wordReads(["aaaa", "bbbb", "cccc"], 10)).toEqual([
      "aaaa\nbbbb",
      "cccc",
    ]);
    expect(wordReads(["x".repeat(20), "y"], 10)).toEqual(["x".repeat(20), "y"]);
  });
});

describe("readPictures", () => {
  it("numbers a read's pictures from one in the order its marks name them, and keeps a mark that names no picture", () => {
    expect(
      readPictures("Soal [image 3] dan [image 1] lagi [image 3] [image 9]", [
        "satu",
        "dua",
        "tiga",
      ])
    ).toEqual({
      pictures: ["tiga", "satu"],
      text: "Soal [image 1] dan [image 2] lagi [image 1] [image 9]",
    });
    expect(readPictures("Tanpa gambar", ["satu"])).toEqual({
      pictures: [],
      text: "Tanpa gambar",
    });
  });
});
