import { describe, expect, it } from "@effect/vitest";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import {
  characterCount,
  lineCount,
  overlongToastCopy,
  overlongToastParts,
  TOAST_DESCRIPTION_LINE_CHARACTERS,
  TOAST_DESCRIPTION_LINES,
  TOAST_TITLE_LINE_CHARACTERS,
  TOAST_TITLE_LINES,
} from "@repo/internationalization/src/toast";
import { Array as Arr, Record as Rec } from "effect";

describe("toast copy at 320px", () => {
  it("keeps every German title on one line and every description on two", () => {
    expect(overlongToastCopy(de.Toast)).toEqual([]);
  });

  it("keeps every English title on one line and every description on two", () => {
    expect(overlongToastCopy(en.Toast)).toEqual([]);
  });

  it("keeps every Indonesian title on one line and every description on two", () => {
    expect(overlongToastCopy(id.Toast)).toEqual([]);
  });

  it("gives every locale the same toast copy keys, so no toast is missing a language", () => {
    expect(Arr.difference(Rec.keys(en.Toast), Rec.keys(de.Toast))).toEqual([]);
    expect(Arr.difference(Rec.keys(de.Toast), Rec.keys(en.Toast))).toEqual([]);
    expect(Arr.difference(Rec.keys(en.Toast), Rec.keys(id.Toast))).toEqual([]);
    expect(Arr.difference(Rec.keys(id.Toast), Rec.keys(en.Toast))).toEqual([]);
  });

  it("reports a title that wraps past its one line, and nothing for a title on it", () => {
    expect(
      overlongToastParts({
        title: "x".repeat(TOAST_TITLE_LINE_CHARACTERS + 1),
      })
    ).toEqual([{ limit: TOAST_TITLE_LINES, lines: 2, part: "title" }]);
    expect(
      overlongToastParts({ title: "x".repeat(TOAST_TITLE_LINE_CHARACTERS) })
    ).toEqual([]);
  });

  it("wraps a title by its words, so two words that do not fit one line are two lines", () => {
    const fits = `${"x".repeat(18)} ${"x".repeat(17)}`;
    const wraps = `${"x".repeat(20)} ${"x".repeat(16)}`;

    expect(fits.length).toBe(TOAST_TITLE_LINE_CHARACTERS);
    expect(overlongToastParts({ title: fits })).toEqual([]);
    expect(overlongToastParts({ title: wraps })).toEqual([
      { limit: TOAST_TITLE_LINES, lines: 2, part: "title" },
    ]);
  });

  it("counts a description by the lines its words fill, not by its characters", () => {
    // Two 20-letter words do not share a 37-character line, so each one is a line.
    const threeLines = `${"x".repeat(20)} ${"x".repeat(20)} ${"x".repeat(20)}`;
    // Two 18-letter words share one line, so these three words take two.
    const twoLines = `${"x".repeat(18)} ${"x".repeat(18)} ${"x".repeat(18)}`;

    expect(threeLines.length).toBeLessThan(
      TOAST_DESCRIPTION_LINE_CHARACTERS * TOAST_DESCRIPTION_LINES
    );
    expect(
      overlongToastParts({ description: threeLines, title: "Saved." })
    ).toEqual([
      { limit: TOAST_DESCRIPTION_LINES, lines: 3, part: "description" },
    ]);
    expect(
      overlongToastParts({ description: twoLines, title: "Saved." })
    ).toEqual([]);
  });

  it("gives a word longer than a line its own lines, and the word after it a new one", () => {
    const longWord = "x".repeat(TOAST_DESCRIPTION_LINE_CHARACTERS + 1);

    expect(lineCount(longWord, TOAST_DESCRIPTION_LINE_CHARACTERS)).toBe(2);
    expect(lineCount(`${longWord} y`, TOAST_DESCRIPTION_LINE_CHARACTERS)).toBe(
      3
    );
  });

  it("measures no description and an empty text as no lines", () => {
    expect(lineCount("", TOAST_DESCRIPTION_LINE_CHARACTERS)).toBe(0);
    expect(overlongToastParts({ title: "Saved." })).toEqual([]);
  });

  it("names the key of each copy that does not fit", () => {
    expect(
      overlongToastCopy({
        "too-long": { title: "x".repeat(TOAST_TITLE_LINE_CHARACTERS + 1) },
      })
    ).toEqual([
      {
        key: "too-long",
        limit: TOAST_TITLE_LINES,
        lines: 2,
        part: "title",
      },
    ]);
  });

  it("counts a letter with an accent or an emoji as one character", () => {
    expect(characterCount("Ñandú 👍")).toBe(7);
  });
});
