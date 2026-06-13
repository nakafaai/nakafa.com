import {
  buildNakafaContentRef,
  getNakafaContentResourceUri,
  normalizeNakafaContentInput,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent references", () => {
  it("normalizes route and URL projections into graph-backed references", () => {
    const quranRef = parseNakafaContentRef("en/quran/1");
    const fallbackRef = parseNakafaContentRef("quran/1", "id");
    const urlRef = parseNakafaContentRef(
      "https://www.nakafa.com/en/quran/1.md"
    );
    const directRef = buildNakafaContentRef("en", "quran/1", "quran");

    expect(Option.getOrUndefined(quranRef)).toStrictEqual(directRef);
    expect(Option.getOrUndefined(fallbackRef)?.content_id).toBe(
      "asset:id:quran:quran-surah:1"
    );
    expect(Option.getOrUndefined(urlRef)?.content_id).toBe(
      "asset:en:quran:quran-surah:1"
    );
  });

  it("builds resource URIs whose asset IDs are resolved by the backend", () => {
    const directRef = buildNakafaContentRef("en", "quran/1", "quran");
    const resourceUri = getNakafaContentResourceUri(directRef.content_id);

    expect(resourceUri).toBe("nakafa://content/asset:en:quran:quran-surah:1");
    expect(normalizeNakafaContentInput(resourceUri)).toBe(directRef.content_id);
    expect(Option.isNone(parseNakafaContentRef(resourceUri))).toBe(true);
  });

  it("rejects empty, unsafe, unsupported, and external references", () => {
    expect(Option.isNone(parseNakafaContentRef(""))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("en"))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("en/../quran/1"))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("en/unknown/1"))).toBe(true);
    expect(
      Option.isNone(parseNakafaContentRef("https://example.com/en/quran/1"))
    ).toBe(true);
  });
});
