import { describe, expect, it } from "@effect/vitest";
import { Emoji } from "@repo/backend/confect/classroom/forum/tally";
import { Array as Arr, Option, Schema } from "effect";
import {
  EmojiCategory,
  emojiOf,
  emojiSections,
  gridRows,
  matchEmoji,
  QUICK_EMOJI,
  sectionStarts,
  stepEmoji,
} from "@/components/tenant/classes/forum/emoji";
import { GLYPHS } from "@/components/tenant/classes/forum/glyphs";

const indonesian = Arr.map(GLYPHS, (glyph) => emojiOf(glyph, "id"));

/** The emoji `query` finds for an Indonesian reader. */
const found = (query: string) =>
  Arr.map(matchEmoji(indonesian, query), (emoji) => emoji.emoji);

describe("the chat's emoji", () => {
  it("offers only what the server keeps, each once, in every category", () => {
    const offered = Arr.appendAll(
      Arr.map(GLYPHS, ([emoji]) => emoji),
      QUICK_EMOJI
    );
    expect(Arr.filter(offered, (emoji) => !Schema.is(Emoji)(emoji))).toEqual(
      []
    );
    expect(Arr.dedupe(Arr.map(GLYPHS, ([emoji]) => emoji))).toHaveLength(
      GLYPHS.length
    );
    expect(
      Arr.map(emojiSections(indonesian), (section) => section.category)
    ).toEqual(EmojiCategory.literals);
  });

  it("names an emoji in the reader's language, and in English for a language it has no words in", () => {
    const smile = Arr.getUnsafe(GLYPHS, 0);
    expect(emojiOf(smile, "id").name).toBe("wajah gembira");
    expect(emojiOf(smile, "de").name).toBe("grinsendes Gesicht");
    expect(emojiOf(smile, "en").name).toBe("grinning face");
    expect(emojiOf(smile, "fr").name).toBe("grinning face");
  });

  it("finds emoji by the start of their words in the reader's language and in English, with or without accents", () => {
    expect(found("buku")).toContain("📚");
    expect(found("book")).toContain("📚");
    expect(found("kura")).toContain("🐢");
    expect(found("TERIMA kasih")).toEqual(["🙏"]);
    expect(found("zzzzz")).toEqual([]);
    expect(matchEmoji(indonesian, "  ")).toHaveLength(GLYPHS.length);
    const german = Arr.map(GLYPHS, (glyph) => emojiOf(glyph, "de"));
    const lacheln = Arr.map(
      matchEmoji(german, "lacheln"),
      ({ emoji }) => emoji
    );
    expect(lacheln).toEqual(
      Arr.map(matchEmoji(german, "lächeln"), ({ emoji }) => emoji)
    );
    expect(lacheln).toContain("😀");
  });

  it("lays each section out in rows of its own, and counts where each section starts", () => {
    expect(sectionStarts([3, 2, 4])).toEqual([0, 3, 5]);
    expect(gridRows([3, 2, 4], 2)).toEqual([
      [0, 1],
      [2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    expect(gridRows([], 8)).toEqual([]);
  });

  it("moves the active emoji as a grid does, and leaves other keys to the field", () => {
    const rows = gridRows([3, 2], 2);
    expect(stepEmoji(rows, 0, "ArrowRight")).toEqual(Option.some(1));
    expect(stepEmoji(rows, 4, "ArrowRight")).toEqual(Option.some(4));
    expect(stepEmoji(rows, 0, "ArrowLeft")).toEqual(Option.some(0));
    expect(stepEmoji(rows, 1, "ArrowDown")).toEqual(Option.some(2));
    expect(stepEmoji(rows, 2, "ArrowDown")).toEqual(Option.some(3));
    expect(stepEmoji(rows, 4, "ArrowDown")).toEqual(Option.some(4));
    expect(stepEmoji(rows, 4, "ArrowUp")).toEqual(Option.some(2));
    expect(stepEmoji(rows, 1, "ArrowUp")).toEqual(Option.some(1));
    expect(stepEmoji(rows, 2, "Home")).toEqual(Option.some(0));
    expect(stepEmoji(rows, 2, "End")).toEqual(Option.some(4));
    expect(stepEmoji(rows, 2, "a")).toEqual(Option.none());
    expect(stepEmoji([], 0, "ArrowDown")).toEqual(Option.none());
  });
});
