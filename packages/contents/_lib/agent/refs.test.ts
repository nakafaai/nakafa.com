import {
  buildNakafaContentRef,
  getNakafaContentResourceUri,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent references", () => {
  it("normalizes content IDs, URLs, markdown URLs, resource URIs, and fallbacks", () => {
    const quranRef = parseNakafaContentRef("en/quran/1");
    const fallbackRef = parseNakafaContentRef("quran/1", "id");
    const urlRef = parseNakafaContentRef(
      "https://www.nakafa.com/en/quran/1.md"
    );
    const resourceUri = getNakafaContentResourceUri("en/quran/1");
    const resourceRef = parseNakafaContentRef(resourceUri);
    const directRef = buildNakafaContentRef("en", "quran/1", "quran");

    expect(Option.getOrUndefined(quranRef)).toStrictEqual(directRef);
    expect(Option.getOrUndefined(fallbackRef)?.content_id).toBe("id/quran/1");
    expect(Option.getOrUndefined(urlRef)?.content_id).toBe("en/quran/1");
    expect(resourceUri).toBe("nakafa://content/en%2Fquran%2F1");
    expect(Option.getOrUndefined(resourceRef)?.content_id).toBe("en/quran/1");
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
