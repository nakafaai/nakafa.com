import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import type { LinkTarget } from "@/lib/routing/link";
import {
  addressTarget,
  articleCategoryTarget,
  curriculumPublicPathTarget,
  curriculumTarget,
  publicPathTarget,
  quranSurahTarget,
} from "@/lib/routing/target";

/** The route a target reaches, so each assertion names the page it opens. */
function routeOf(target: Option.Option<LinkTarget>) {
  return Option.map(target, (linked) => linked.to);
}

describe("public path targets", () => {
  it("names the article index, a category, and an article, and no other article shape", () => {
    expect(routeOf(publicPathTarget("articles"))).toEqual(
      Option.some("/$locale/articles")
    );
    expect(routeOf(publicPathTarget("articles/"))).toEqual(
      Option.some("/$locale/articles")
    );
    expect(routeOf(publicPathTarget("articles/politics"))).toEqual(
      Option.some("/$locale/articles/$category")
    );
    expect(publicPathTarget("articles/politics/climate")).toEqual(
      Option.some(
        expect.objectContaining({
          params: { category: "politics", slug: "climate" },
          to: "/$locale/articles/$category/$slug",
        })
      )
    );
    expect(Option.isNone(publicPathTarget("articles/politics/"))).toBe(true);
    expect(Option.isNone(publicPathTarget("articles/politics/a/b"))).toBe(true);
  });

  it("names the Quran index and a surah, and no other Quran shape", () => {
    expect(routeOf(publicPathTarget("quran"))).toEqual(
      Option.some("/$locale/quran")
    );
    expect(routeOf(publicPathTarget("quran/"))).toEqual(
      Option.some("/$locale/quran")
    );
    expect(publicPathTarget("quran/2")).toEqual(
      Option.some(
        expect.objectContaining({
          params: { surah: "2" },
          to: "/$locale/quran/$surah",
        })
      )
    );
    expect(Option.isNone(publicPathTarget("quran/2/ayah"))).toBe(true);
  });

  it("names the curriculum index, a program, and a page inside a program", () => {
    expect(routeOf(publicPathTarget("curriculum"))).toEqual(
      Option.some("/$locale/curricula")
    );
    expect(publicPathTarget("curriculum/merdeka")).toEqual(
      Option.some(
        expect.objectContaining({
          params: { _splat: "", curriculum: "merdeka" },
          to: "/$locale/curricula/$curriculum/$",
        })
      )
    );
    expect(publicPathTarget("curriculum/merdeka/class-11/mathematics")).toEqual(
      Option.some(
        expect.objectContaining({
          params: { _splat: "class-11/mathematics", curriculum: "merdeka" },
        })
      )
    );
    expect(routeOf(curriculumPublicPathTarget("curriculum/"))).toEqual(
      Option.some("/$locale/curricula")
    );
    expect(Option.isNone(curriculumPublicPathTarget("subjects/x/y"))).toBe(
      true
    );
    expect(Option.isNone(curriculumPublicPathTarget(""))).toBe(true);
  });

  it("names a material by its subject, topic and lesson, and carries the context hint", () => {
    expect(
      publicPathTarget("subjects/mathematics/algebra/functions", "merdeka~node")
    ).toEqual(
      Option.some(
        expect.objectContaining({
          params: {
            _splat: "functions",
            subject: "mathematics",
            topic: "algebra",
          },
          search: { ctx: "merdeka~node" },
          to: "/$locale/materials/$subject/$topic/$",
        })
      )
    );
    expect(publicPathTarget("subjects/mathematics/algebra")).toEqual(
      Option.some(
        expect.objectContaining({
          params: { _splat: "", subject: "mathematics", topic: "algebra" },
          search: {},
        })
      )
    );
    expect(Option.isNone(publicPathTarget("subjects/mathematics"))).toBe(true);
  });

  it("names any other public path as a signed Page, and the empty path as no page", () => {
    expect(publicPathTarget("developers")).toEqual(
      Option.some(
        expect.objectContaining({
          params: { _splat: "developers" },
          to: "/$locale/$",
        })
      )
    );
    expect(Option.isNone(publicPathTarget(""))).toBe(true);
  });
});

describe("app address targets", () => {
  it("reads the signed path after the locale, and the material context of its query", () => {
    expect(routeOf(addressTarget("/en/curriculum/merdeka"))).toEqual(
      Option.some("/$locale/curricula/$curriculum/$")
    );
    expect(
      addressTarget("/en/subjects/mathematics/algebra/functions?ctx=merdeka~n")
    ).toEqual(
      Option.some(
        expect.objectContaining({
          search: { ctx: "merdeka~n" },
          to: "/$locale/materials/$subject/$topic/$",
        })
      )
    );
    expect(Option.isNone(addressTarget("/en"))).toBe(true);
  });
});

describe("typed target builders", () => {
  it("builds a program page, an article category, and a Quran surah", () => {
    expect(
      curriculumTarget({ curriculum: "merdeka", path: ["class-11"] })
    ).toEqual(
      expect.objectContaining({
        params: { _splat: "class-11", curriculum: "merdeka" },
      })
    );
    expect(articleCategoryTarget("politics")).toEqual(
      expect.objectContaining({
        params: { category: "politics" },
        to: "/$locale/articles/$category",
      })
    );
    expect(quranSurahTarget(2)).toEqual(
      expect.objectContaining({
        params: { surah: "2" },
        to: "/$locale/quran/$surah",
      })
    );
  });
});
