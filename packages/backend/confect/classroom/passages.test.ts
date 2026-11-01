import { describe, expect, it } from "@effect/vitest";
import {
  MAX_PASSAGES,
  passagesOf,
  sourcesOf,
} from "@repo/backend/confect/classroom/passages";
import { Array as Arr } from "effect";

describe("classroom/passages", () => {
  it("joins short paragraphs and leaves out empty ones", () => {
    expect(passagesOf("Satu.\n\n\n\n  \n\nDua.")).toEqual(["Satu.\n\nDua."]);
  });

  it("starts a new passage when the next paragraph does not fit", () => {
    const paragraph = "a".repeat(800);
    expect(passagesOf(`${paragraph}\n\n${paragraph}`)).toEqual([
      paragraph,
      paragraph,
    ]);
  });

  it("cuts a paragraph longer than a passage", () => {
    expect(
      Arr.map(passagesOf("a".repeat(2500)), (passage) => passage.length)
    ).toEqual([1200, 1200, 100]);
  });

  it("keeps the start of a long file", () => {
    expect(passagesOf("a".repeat(100_000))).toHaveLength(MAX_PASSAGES);
  });

  it("puts the teacher's files ahead of Nakafa's sources", () => {
    expect(sourcesOf([{ text: "Isi.", title: "Modul" }], "Sumber Nakafa")).toBe(
      'From the teacher\'s file "Modul":\nIsi.\n\nSumber Nakafa'
    );
  });
});
