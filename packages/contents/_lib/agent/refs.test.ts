import {
  buildNakafaContentRef,
  createNakafaContentRefFromGraphProjection,
  getNakafaContentResourceUri,
  normalizeNakafaContentInput,
  parseNakafaContentRef,
} from "@repo/contents/_lib/agent/refs";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent references", () => {
  it("normalizes canonical URL projections into graph-backed references", () => {
    const quranRef = parseNakafaContentRef("https://nakafa.com/en/quran/1");
    const urlRef = parseNakafaContentRef(
      "https://www.nakafa.com/en/quran/1.md"
    );
    const directRef = buildNakafaContentRef("en", "quran/1", "quran");

    expect(Option.getOrUndefined(quranRef)).toStrictEqual(directRef);
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

  it("builds refs from persisted graph projections without route-derived IDs", () => {
    const ref = createNakafaContentRefFromGraphProjection({
      alignmentId: "alignment:catalog:article:example",
      assetId: "asset:en:catalog:article:example",
      conceptId: "concept:catalog:article:example",
      content_id: "asset:en:catalog:article:example",
      learningObjectId: "lo:catalog:article:example",
      lensId: "lens:catalog:article:example",
      locale: "en",
      route: "articles/politics/example",
      section: "articles",
    });

    expect(Option.getOrUndefined(ref)).toStrictEqual({
      alignmentId: "alignment:catalog:article:example",
      assetId: "asset:en:catalog:article:example",
      conceptId: "concept:catalog:article:example",
      content_id: "asset:en:catalog:article:example",
      learningObjectId: "lo:catalog:article:example",
      lensId: "lens:catalog:article:example",
      locale: "en",
      markdown_url: "https://nakafa.com/en/articles/politics/example.md",
      route: "articles/politics/example",
      section: "articles",
      url: "https://nakafa.com/en/articles/politics/example",
    });
  });

  it("rejects graph projections whose content ID does not match the asset ID", () => {
    const ref = createNakafaContentRefFromGraphProjection({
      alignmentId: "alignment:catalog:article:example",
      assetId: "asset:en:catalog:article:example",
      conceptId: "concept:catalog:article:example",
      content_id: "asset:en:catalog:article:other",
      learningObjectId: "lo:catalog:article:example",
      lensId: "lens:catalog:article:example",
      locale: "en",
      route: "articles/politics/example",
      section: "articles",
    });

    expect(Option.isNone(ref)).toBe(true);
  });

  it("rejects route and section mismatches before creating graph refs", () => {
    expect(() =>
      buildNakafaContentRef("en", "articles/politics/example", "subject")
    ).toThrow("does not match graph route");
    expect(() =>
      buildNakafaContentRef("en", "unknown/example", "articles")
    ).toThrow("Cannot build Nakafa graph content ref");
  });

  it("rejects empty, unsafe, unsupported, and external references", () => {
    expect(Option.isNone(parseNakafaContentRef(""))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("en/quran/1"))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("quran/1"))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("en"))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("https://nakafa.com/"))).toBe(
      true
    );
    expect(Option.isNone(parseNakafaContentRef("https://nakafa.com/en"))).toBe(
      true
    );
    expect(Option.isNone(parseNakafaContentRef("en/../quran/1"))).toBe(true);
    expect(Option.isNone(parseNakafaContentRef("en/unknown/1"))).toBe(true);
    expect(
      Option.isNone(parseNakafaContentRef("https://nakafa.com/en/unknown/1"))
    ).toBe(true);
    expect(
      Option.isNone(
        parseNakafaContentRef("https://nakafa.com/en/articles/example")
      )
    ).toBe(true);
    expect(
      Option.isNone(parseNakafaContentRef("https://example.com/en/quran/1"))
    ).toBe(true);
    expect(normalizeNakafaContentInput(" quran/1 ")).toBe("quran/1");
  });
});
