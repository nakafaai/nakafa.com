// @vitest-environment node
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createLocalizedAlternates,
  createProjectedRouteAlternates,
} from "@/lib/utils/seo/alternates";

describe("createLocalizedAlternates", () => {
  it("builds canonical, locale, default, and markdown alternates", () => {
    const result = createLocalizedAlternates("/id/articles/politics/example", {
      types: {
        "text/markdown": "/id/articles/politics/example.md",
      },
    });

    expect(result).toEqual({
      canonical: "/id/articles/politics/example",
      languages: {
        en: "/en/articles/politics/example",
        id: "/id/articles/politics/example",
        "x-default": "/en/articles/politics/example",
      },
      types: {
        "text/markdown": "/id/articles/politics/example.md",
      },
    });
  });

  it("normalizes paths without a leading slash", () => {
    const result = createLocalizedAlternates("en/articles/politics/example");

    expect(result).toEqual({
      canonical: "/en/articles/politics/example",
      languages: {
        en: "/en/articles/politics/example",
        id: "/id/articles/politics/example",
        "x-default": "/en/articles/politics/example",
      },
    });
  });

  it("handles locale root paths", () => {
    const result = createLocalizedAlternates("/id");

    expect(result).toEqual({
      canonical: "/id",
      languages: {
        en: "/en",
        id: "/id",
        "x-default": "/en",
      },
    });
  });

  it("keeps unlocalized paths as the shared route path", () => {
    const result = createLocalizedAlternates("/robots.txt");

    expect(result).toEqual({
      canonical: "/robots.txt",
      languages: {
        en: "/en/robots.txt",
        id: "/id/robots.txt",
        "x-default": "/en/robots.txt",
      },
    });
  });

  it("uses the default locale path when custom alternates omit x-default", () => {
    const result = createLocalizedAlternates("/id/materi/matematika", {
      languages: {
        id: "/id/materi/matematika",
      },
    });

    expect(result.languages).toEqual({
      id: "/id/materi/matematika",
      "x-default": "/en/materi/matematika",
    });
  });

  it("builds hreflang alternates from projected material routes", () => {
    const routes = Effect.runSync(listPublicRoutes());
    const route = routes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath ===
          "material/lesson/mathematics/integral/riemann-sum"
    );

    if (!route) {
      expect(route).toBeDefined();
      return;
    }

    expect(createProjectedRouteAlternates(route, routes)).toMatchObject({
      canonical: "/id/materi/matematika/integral/jumlahan-riemann",
      languages: {
        en: "/en/subjects/mathematics/integral/riemann-sum",
        id: "/id/materi/matematika/integral/jumlahan-riemann",
      },
    });
  });

  it("omits projected hreflang values when a locale route is absent", () => {
    const routes = Effect.runSync(listPublicRoutes());
    const route = routes.find(
      (candidate) =>
        candidate.kind === "subject-lesson" &&
        candidate.locale === "id" &&
        candidate.sourcePath ===
          "material/lesson/mathematics/integral/riemann-sum"
    );

    if (!route) {
      expect(route).toBeDefined();
      return;
    }

    expect(createProjectedRouteAlternates(route, [route])).toMatchObject({
      canonical: "/id/materi/matematika/integral/jumlahan-riemann",
      languages: {
        id: "/id/materi/matematika/integral/jumlahan-riemann",
      },
    });
  });

  it("builds hreflang alternates for curriculum and assessment contexts", () => {
    const routes = Effect.runSync(listPublicRoutes());
    const curriculum = routes.find(
      (candidate) =>
        candidate.kind === "curriculum-context" &&
        candidate.locale === "id" &&
        candidate.programKey === "id-kurikulum-merdeka" &&
        candidate.nodeKey.endsWith("integral")
    );
    const assessment = routes.find(
      (candidate) =>
        candidate.kind === "assessment-context" &&
        candidate.locale === "id" &&
        candidate.programKey === "snbt-2026" &&
        candidate.publicPath ===
          "ujian/snbt/pengetahuan-kuantitatif/tryout/2026"
    );

    if (!curriculum) {
      expect(curriculum).toBeDefined();
      return;
    }

    if (!assessment) {
      expect(assessment).toBeDefined();
      return;
    }

    expect(createProjectedRouteAlternates(curriculum, routes)).toMatchObject({
      canonical: `/${curriculum.locale}/${curriculum.publicPath}`,
      languages: {
        en: expect.stringContaining("/en/curriculum/merdeka/"),
        id: expect.stringContaining("/id/kurikulum/merdeka/"),
      },
    });
    expect(createProjectedRouteAlternates(assessment, routes)).toMatchObject({
      canonical: "/id/ujian/snbt/pengetahuan-kuantitatif/tryout/2026",
      languages: {
        en: "/en/exams/snbt/quantitative-knowledge/mock-test/2026",
        id: "/id/ujian/snbt/pengetahuan-kuantitatif/tryout/2026",
      },
    });
  });
});
