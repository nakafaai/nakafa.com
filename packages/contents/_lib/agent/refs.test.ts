import {
  createNakafaContentRefFromGraphProjection,
  normalizeNakafaContentInput,
  parseNakafaUrlRoute,
} from "@repo/contents/_lib/agent/refs";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

const graphProjection = {
  alignmentId: "alignment:catalog:article:example",
  assetId: "asset:en:catalog:article:example",
  conceptId: "concept:catalog:article:example",
  content_id: "asset:en:catalog:article:example",
  learningObjectId: "lo:catalog:article:example",
  lensId: "lens:catalog:article:example",
  locale: "en",
  route: "articles/politics/example",
  section: "articles",
} as const;

describe("Nakafa agent references", () => {
  it("parses canonical Nakafa URLs for backend route lookup", () => {
    expect(
      Option.getOrUndefined(
        parseNakafaUrlRoute("https://www.nakafa.com/en/quran/1.md")
      )
    ).toStrictEqual({ locale: "en", route: "quran/1" });
    expect(
      Option.isNone(parseNakafaUrlRoute("https://example.com/en/quran/1"))
    ).toBe(true);
    expect(Option.isNone(parseNakafaUrlRoute("en/quran/1"))).toBe(true);
    expect(
      Option.isNone(parseNakafaUrlRoute("https://nakafa.com/fr/quran/1"))
    ).toBe(true);
    expect(Option.isNone(parseNakafaUrlRoute("https://nakafa.com/"))).toBe(
      true
    );
    expect(Option.isNone(parseNakafaUrlRoute("https://nakafa.com/en"))).toBe(
      true
    );
  });

  it("builds refs from persisted graph projections", () => {
    const ref = createNakafaContentRefFromGraphProjection(graphProjection);

    expect(Option.getOrUndefined(ref)).toStrictEqual({
      ...graphProjection,
      markdown_url: "https://nakafa.com/en/articles/politics/example.md",
      url: "https://nakafa.com/en/articles/politics/example",
    });
  });

  it("rejects inconsistent or malformed persisted graph projections", () => {
    expect(
      Option.isNone(
        createNakafaContentRefFromGraphProjection({
          ...graphProjection,
          content_id: "asset:en:catalog:article:other",
        })
      )
    ).toBe(true);
    expect(
      Option.isNone(
        createNakafaContentRefFromGraphProjection({
          ...graphProjection,
          locale: "fr",
        })
      )
    ).toBe(true);
    expect(
      Option.isNone(
        createNakafaContentRefFromGraphProjection({
          ...graphProjection,
          route: "../unsafe",
        })
      )
    ).toBe(true);
  });

  it("normalizes supported content identifiers", () => {
    expect(
      normalizeNakafaContentInput(
        "nakafa://content/asset:en:catalog:article:example"
      )
    ).toBe(graphProjection.content_id);
    expect(
      normalizeNakafaContentInput(
        "https://nakafa.com/en/articles/politics/example"
      )
    ).toBe("/en/articles/politics/example");
    expect(normalizeNakafaContentInput(" quran/1 ")).toBe("quran/1");
  });
});
