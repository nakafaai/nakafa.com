import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  createNakafaContentRef,
  createNakafaContentRefFromGraphProjection,
  getNakafaContentResourceUri,
  normalizeNakafaContentInput,
  parseNakafaContentRef,
  parseNakafaContentRefEffect,
  parseNakafaContentRefFields,
} from "@repo/contents/_lib/agent/refs";
import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("Nakafa agent references", () => {
  it("normalizes canonical URL projections into graph-backed references", () => {
    const quranRef = parseNakafaContentRef("https://nakafa.com/en/quran/1");
    const urlRef = parseNakafaContentRef(
      "https://www.nakafa.com/en/quran/1.md"
    );
    const directRef = readNakafaContentRefFixture("en", "quran/1", "quran");

    expect(Option.getOrUndefined(quranRef)).toStrictEqual(directRef);
    expect(Option.getOrUndefined(urlRef)?.content_id).toBe(
      "asset:en:quran:quran-surah:1"
    );
  });

  it("builds resource URIs whose asset IDs are resolved by the backend", () => {
    const directRef = readNakafaContentRefFixture("en", "quran/1", "quran");
    const resourceUri = getNakafaContentResourceUri(directRef.content_id);

    expect(resourceUri).toBe("nakafa://content/asset:en:quran:quran-surah:1");
    expect(normalizeNakafaContentInput(resourceUri)).toBe(directRef.content_id);
    expect(Option.isNone(parseNakafaContentRef(resourceUri))).toBe(true);
  });

  it("resolves public material URLs through route projection", async () => {
    const topicRef = await Effect.runPromise(
      parseNakafaContentRefEffect(
        "https://nakafa.com/id/materi/matematika/integral"
      )
    );
    const lessonRef = await Effect.runPromise(
      parseNakafaContentRefEffect(
        "https://nakafa.com/en/subjects/mathematics/integral/riemann-sum"
      )
    );
    const contextRef = await Effect.runPromise(
      parseNakafaContentRefEffect(
        "https://nakafa.com/en/curriculum/merdeka/class-12/mathematics/integral"
      )
    );

    expect(Option.getOrUndefined(topicRef)?.route).toBe(
      "material/lesson/mathematics/integral"
    );
    expect(Option.getOrUndefined(lessonRef)?.route).toBe(
      "material/lesson/mathematics/integral/riemann-sum"
    );
    expect(Option.isNone(contextRef)).toBe(true);
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

  it("rejects malformed persisted graph projection input before decoding refs", () => {
    expect(
      Option.isNone(
        createNakafaContentRefFromGraphProjection({
          alignmentId: "alignment:catalog:article:example",
          assetId: "asset:en:catalog:article:example",
          conceptId: "concept:catalog:article:example",
          content_id: "asset:en:catalog:article:example",
          learningObjectId: "lo:catalog:article:example",
          lensId: "lens:catalog:article:example",
          locale: "fr",
          route: "articles/politics/example",
          section: "articles",
        })
      )
    ).toBe(true);
    expect(
      Option.isNone(
        createNakafaContentRefFromGraphProjection({
          alignmentId: "alignment:catalog:article:example",
          assetId: "asset:en:catalog:article:example",
          conceptId: "concept:catalog:article:example",
          content_id: "asset:en:catalog:article:example",
          learningObjectId: "lo:catalog:article:example",
          lensId: "lens:catalog:article:example",
          locale: "en",
          route: "../unsafe",
          section: "articles",
        })
      )
    ).toBe(true);
  });

  it("rejects route and section mismatches before creating graph refs", async () => {
    expect(Option.isNone(createNakafaContentRef("en", "", "quran"))).toBe(true);
    expect(
      Option.isNone(
        createNakafaContentRef("en", "articles/politics/example", "material")
      )
    ).toBe(true);
    expect(
      Option.isNone(createNakafaContentRef("en", "unknown/example", "articles"))
    ).toBe(true);
    expect(
      Exit.isFailure(
        await Effect.runPromiseExit(
          parseNakafaContentRefFields(
            "en",
            "articles/politics/example",
            "material"
          )
        )
      )
    ).toBe(true);
    expect(() =>
      readNakafaContentRefFixture("en", "unknown/example", "articles")
    ).toThrow("Expected Nakafa content ref fixture");
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
