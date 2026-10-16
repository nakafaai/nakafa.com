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
  overlongToastCopy,
  overlongToastParts,
  TOAST_DESCRIPTION_CHARACTERS,
  TOAST_TITLE_CHARACTERS,
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

  it("reports a title one character past its line, and nothing for a title on it", () => {
    expect(
      overlongToastParts({ title: "x".repeat(TOAST_TITLE_CHARACTERS + 1) })
    ).toEqual([
      {
        budget: TOAST_TITLE_CHARACTERS,
        characters: TOAST_TITLE_CHARACTERS + 1,
        part: "title",
      },
    ]);
    expect(
      overlongToastParts({ title: "x".repeat(TOAST_TITLE_CHARACTERS) })
    ).toEqual([]);
  });

  it("reports a description past two lines, while a description on two lines fits", () => {
    expect(
      overlongToastParts({
        description: "x".repeat(TOAST_DESCRIPTION_CHARACTERS + 1),
        title: "Saved.",
      })
    ).toEqual([
      {
        budget: TOAST_DESCRIPTION_CHARACTERS,
        characters: TOAST_DESCRIPTION_CHARACTERS + 1,
        part: "description",
      },
    ]);
    expect(
      overlongToastParts({
        description: "x".repeat(TOAST_DESCRIPTION_CHARACTERS),
        title: "Saved.",
      })
    ).toEqual([]);
  });

  it("names the key of each copy that does not fit", () => {
    expect(
      overlongToastCopy({
        "too-long": { title: "x".repeat(TOAST_TITLE_CHARACTERS + 1) },
      })
    ).toEqual([
      {
        budget: TOAST_TITLE_CHARACTERS,
        characters: TOAST_TITLE_CHARACTERS + 1,
        key: "too-long",
        part: "title",
      },
    ]);
  });

  it("counts a letter with an accent or an emoji as one character", () => {
    expect(characterCount("Ñandú 👍")).toBe(7);
  });
});
