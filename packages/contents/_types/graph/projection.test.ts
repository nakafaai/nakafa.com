import {
  getQuranSurahNumberForRoute,
  getSourceRouteProjection,
  getSourceRouteProjectionForRoute,
  type SourceRouteProjectionOptions,
} from "@repo/contents/_types/graph/projection";
import { normalizeSourceRouteProjection } from "@repo/contents/_types/graph/route";
import {
  getCurriculumLensScopeForKind,
  getSourceRegistryRootForKind,
  SourceRouteProjectionSchema,
} from "@repo/contents/_types/graph/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Projects one Indonesian route through the localized graph contract. */
function getIndonesianProjection(
  route: string,
  options?: SourceRouteProjectionOptions
) {
  return getSourceRouteProjectionForRoute(route, "id", options);
}

/** Projects one English route through the localized graph contract. */
function getEnglishProjection(route: string) {
  return getSourceRouteProjectionForRoute(route, "en");
}

describe("source route projection", () => {
  it("projects current public routes into graph metadata", () => {
    expect(
      getIndonesianProjection("articles/politics/makna-demokrasi")
    ).toMatchObject({
      conceptSegments: ["article", "politics"],
      kind: "article",
      learningObjectSegments: ["article", "politics", "makna-demokrasi"],
      lensScope: "article-domain",
      lensSegments: ["article", "politics"],
      parentRoute: "articles/politics",
      sourceRoot: "articles",
    });

    expect(getIndonesianProjection("quran/1")).toMatchObject({
      conceptSegments: ["quran", "surah", "1"],
      kind: "quran-surah",
      learningObjectSegments: ["quran-surah", "1"],
      lensScope: "scripture",
      lensSegments: ["quran"],
      parentRoute: "quran",
      quran: { surahSegment: "1" },
      sourceRoot: "quran",
    });

    expect(
      getIndonesianProjection(
        "material/lesson/chemistry/atomic-structure/electron-configuration"
      )
    ).toMatchObject({
      conceptSegments: ["material", "lesson", "chemistry", "atomic-structure"],
      kind: "curriculum-lesson",
      lensScope: "curriculum",
      lensSegments: ["material", "lesson", "chemistry"],
      parentRoute: "material/lesson/chemistry/atomic-structure",
      sourceRoot: "material",
    });
  });

  it("projects try-out countries, exams, tracks, sets, and sections with named parent routes", () => {
    const countryRoute = "try-out/indonesia";
    const examRoute = `${countryRoute}/snbt`;
    const trackRoute = `${examRoute}/2027`;
    const setRoute = `${trackRoute}/set-1`;
    const sectionRoute = `${setRoute}/pengetahuan-kuantitatif`;

    expect(getIndonesianProjection(countryRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia"],
      kind: "tryout-country",
      lensSegments: ["tryout", "indonesia", "catalog"],
      parentRoute: "try-out",
      sourceRoot: "tryout",
    });
    expect(getIndonesianProjection(examRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "snbt"],
      kind: "tryout-exam",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: countryRoute,
      sourceRoot: "tryout",
    });
    expect(getIndonesianProjection(trackRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "snbt", "2027"],
      kind: "tryout-track",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: examRoute,
      sourceRoot: "tryout",
    });
    expect(getIndonesianProjection(setRoute)).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "snbt", "2027", "set-1"],
      kind: "tryout-set",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: trackRoute,
      sourceRoot: "tryout",
    });
    expect(getIndonesianProjection(sectionRoute)).toMatchObject({
      conceptSegments: [
        "tryout",
        "indonesia",
        "snbt",
        "2027",
        "quantitative-knowledge",
      ],
      kind: "tryout-section",
      lensSegments: ["tryout", "indonesia", "snbt"],
      parentRoute: setRoute,
      sourceRoot: "tryout",
    });
  });

  it("uses source keys for graph identity across localized try-out routes", () => {
    const englishTrack = getEnglishProjection(
      "try-out/indonesia/tka/mathematics"
    );
    const indonesianTrack = getIndonesianProjection(
      "try-out/indonesia/tka/matematika"
    );
    const englishSection = getEnglishProjection(
      "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
    );
    const indonesianSection = getIndonesianProjection(
      "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif"
    );

    expect(englishTrack).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "tka", "mathematics"],
      learningObjectSegments: [
        "tryout-track",
        "indonesia",
        "tka",
        "mathematics",
      ],
      route: "try-out/indonesia/tka/mathematics",
    });
    expect(indonesianTrack).toMatchObject({
      conceptSegments: ["tryout", "indonesia", "tka", "mathematics"],
      learningObjectSegments: [
        "tryout-track",
        "indonesia",
        "tka",
        "mathematics",
      ],
      route: "try-out/indonesia/tka/matematika",
    });
    expect(englishSection).toMatchObject({
      conceptSegments: [
        "tryout",
        "indonesia",
        "snbt",
        "2027",
        "quantitative-knowledge",
      ],
      learningObjectSegments: [
        "tryout-section",
        "indonesia",
        "snbt",
        "2027",
        "set-1",
        "quantitative-knowledge",
      ],
    });
    expect(indonesianSection).toMatchObject({
      conceptSegments: englishSection?.conceptSegments,
      learningObjectSegments: englishSection?.learningObjectSegments,
      route: "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
    });
    expect(getEnglishProjection("try-out/indonesia/tka/matematika")).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/tka/mathematics")
    ).toBeNull();
  });

  it("rejects graph identities for staged tracks, sets, and sections", () => {
    const [source] = TRYOUT_SOURCES;
    const track = source?.tracks.at(0);
    const set = track?.sets.at(0);
    const section = set?.sections.at(0);

    expect(source).toBeDefined();
    expect(track).toBeDefined();
    expect(set).toBeDefined();
    expect(section).toBeDefined();

    if (!(source && track && set && section)) {
      return;
    }

    const options = {
      tryouts: [
        {
          ...source,
          tracks: source.tracks.map((candidate) => ({
            ...candidate,
            sets: candidate.sets.map((candidateSet) => ({
              ...candidateSet,
              sections: [],
            })),
          })),
        },
      ],
    } satisfies SourceRouteProjectionOptions;
    const countryRoute = `try-out/${source.countryRouteSlugs.id}`;
    const examRoute = `${countryRoute}/${source.examRouteSlugs.id}`;
    const trackRoute = `${examRoute}/${track.routeSlugs.id}`;
    const setRoute = `${trackRoute}/${set.routeSlugs.id}`;
    const sectionRoute = `${setRoute}/${section.routeSlugs.id}`;

    expect(getIndonesianProjection(countryRoute, options)).toMatchObject({
      kind: "tryout-country",
    });
    expect(getIndonesianProjection(examRoute, options)).toMatchObject({
      kind: "tryout-exam",
    });
    expect(getIndonesianProjection(trackRoute, options)).toBeNull();
    expect(getIndonesianProjection(setRoute, options)).toBeNull();
    expect(getIndonesianProjection(sectionRoute, options)).toBeNull();
  });

  it("rejects malformed projections instead of inferring partial route identity", () => {
    expect(getIndonesianProjection("unknown/root")).toBeNull();
    expect(getIndonesianProjection("articles/politics")).toBeNull();
    expect(getIndonesianProjection("quran")).toBeNull();
    expect(getIndonesianProjection("try-out/malaysia")).toBeNull();
    expect(getIndonesianProjection("try-out/indonesia/unknown")).toBeNull();
    expect(
      getIndonesianProjection(
        "try-out/indonesia/snbt/2027/set-1/unknown-section/extra"
      )
    ).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/snbt/2027/set-1/extra/path")
    ).toBeNull();
    expect(
      getIndonesianProjection("material/lesson/math/topic/one/extra")
    ).toBeNull();
    expect(getIndonesianProjection("quran/not-number")).toBeNull();
    expect(
      getIndonesianProjection(
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge/extra"
      )
    ).toBeNull();
    expect(getIndonesianProjection("try-out/indonesia/snbt/set-1")).toBeNull();
    expect(
      getIndonesianProjection(
        "try-out/indonesia/snbt/set-1/quantitative-knowledge"
      )
    ).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/snbt/2027")
    ).toMatchObject({ kind: "tryout-track" });
    expect(
      getIndonesianProjection("try-out/indonesia/snbt/2027/set-1")
    ).toMatchObject({ kind: "tryout-set" });
    expect(
      getIndonesianProjection(
        "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge"
      )
    ).toBeNull();
    expect(
      getIndonesianProjection(
        "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif"
      )
    ).toMatchObject({ kind: "tryout-section" });
    expect(
      getIndonesianProjection(
        "try-out/indonesia/snbt/2027/set-2/penalaran-umum"
      )
    ).toMatchObject({ kind: "tryout-section" });
    expect(getIndonesianProjection("material/video/topic")).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/snbt/2027/set-1/1")
    ).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/snbt/2027/missing")
    ).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/snbt/2027/set-1/missing")
    ).toBeNull();
    expect(
      getIndonesianProjection(
        "try-out/indonesia/tka/matematika/set-1/matematika"
      )
    ).toBeNull();
    expect(
      getIndonesianProjection("try-out/indonesia/tka/matematika/set-1")
    ).toMatchObject({ kind: "tryout-set" });
  });

  it("keeps declared kind validation next to the projection spec", () => {
    const topicRoute = "material/lesson/physics/waves";

    expect(
      getSourceRouteProjection({
        kind: "curriculum-topic",
        locale: "id",
        route: topicRoute,
      })?.kind
    ).toBe("curriculum-topic");
    expect(
      getSourceRouteProjection({
        kind: "curriculum-lesson",
        locale: "id",
        route: topicRoute,
      })
    ).toBeNull();
  });

  it("emits projections that satisfy the runtime schema", () => {
    const projection = getSourceRouteProjection({
      kind: "quran-surah",
      locale: "id",
      route: "quran/1",
    });

    expect(projection).not.toBeNull();
    expect(Schema.is(SourceRouteProjectionSchema)(projection)).toBe(true);
  });

  it("owns registry roots and lens scopes for graph kinds", () => {
    expect(getSourceRegistryRootForKind("article")).toBe("articles");
    expect(getSourceRegistryRootForKind("tryout-section")).toBe("tryout");
    expect(getSourceRegistryRootForKind("quran-surah")).toBe("quran");
    expect(getCurriculumLensScopeForKind("curriculum-lesson")).toBe(
      "curriculum"
    );
    expect(getCurriculumLensScopeForKind("tryout-set")).toBe("exam");
    expect(getCurriculumLensScopeForKind("tryout-track")).toBe("exam");
  });

  it("owns Quran route selectors used by agent readers", () => {
    expect(getQuranSurahNumberForRoute("quran/1", "id")).toBe(1);
    expect(
      getQuranSurahNumberForRoute("articles/politics/example", "id")
    ).toBeNull();
  });

  it("normalizes noisy projections before matching", () => {
    expect(normalizeSourceRouteProjection("//quran//1/")).toBe("quran/1");
    expect(getIndonesianProjection("//quran//1/")?.route).toBe("quran/1");
  });
});
