import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import type { PublicLearningIndex } from "@repo/contents/_types/route/learning/public";
import * as publicLearningStatic from "@repo/contents/_types/route/learning/static";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocalizedNavigationHref } from "@/lib/routing/locale/resolve";

/**
 * Keeps contextual hrefs unchanged in tests that isolate locale projection
 * failures instead of material context validation.
 */
function preserveContextualHref(
  input: Parameters<PublicLearningIndex["toContextualMaterialHref"]>[0]
) {
  return input.href;
}

/** Resolves a localized href through the Effect boundary used by route callers. */
function resolveHref(href: string, locale: "en" | "id") {
  return Effect.runSync(resolveLocalizedNavigationHref({ href, locale }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLocalizedNavigationHref", () => {
  it("projects material lessons by source identity instead of preserving localized slugs", () => {
    expect(
      resolveHref(
        "/id/materi/ai-ds/metode-linear-ai/sistem-persamaan-linear",
        "en"
      )
    ).toBe("/subjects/ai-ds/linear-methods/system-linear-equation");

    expect(
      resolveHref(
        "/en/subjects/ai-ds/linear-methods/system-linear-equation",
        "id"
      )
    ).toBe("/materi/ai-ds/metode-linear-ai/sistem-persamaan-linear");
  });

  it("projects valid material context hints and drops stale ones", () => {
    expect(
      resolveHref(
        "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear?ctx=merdeka~class-10-mathematics-linear-equation-inequality",
        "en"
      )
    ).toBe(
      "/subjects/mathematics/linear-equation-inequality/system-linear-equation?ctx=merdeka~class-10-mathematics-linear-equation-inequality"
    );

    expect(
      resolveHref(
        "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear?ctx=merdeka~class-10-biology-virus-role",
        "en"
      )
    ).toBe(
      "/subjects/mathematics/linear-equation-inequality/system-linear-equation"
    );
  });

  it("projects other concrete material lessons to the target namespace and slugs", () => {
    expect(resolveHref("/id/materi/fisika/vektor/konsep-vektor", "en")).toBe(
      "/subjects/physics/vector/concept"
    );

    expect(resolveHref("/en/subjects/physics/vector/concept", "id")).toBe(
      "/materi/fisika/vektor/konsep-vektor"
    );
  });

  it("projects curriculum pages by program and node identity", () => {
    expect(resolveHref("/id/kurikulum/merdeka/kelas-10/biologi", "en")).toBe(
      "/curriculum/merdeka/class-10/biology"
    );

    expect(resolveHref("/en/curriculum/merdeka/class-10/biology", "id")).toBe(
      "/kurikulum/merdeka/kelas-10/biologi"
    );
  });

  it("projects practice root and domain pages from concrete practice route identity", () => {
    expect(resolveHref("/id/latihan/snbt", "en")).toBe("/practice/snbt");
    expect(resolveHref("/en/practice/snbt", "id")).toBe("/latihan/snbt");

    expect(resolveHref("/id/latihan/snbt/pengetahuan-kuantitatif", "en")).toBe(
      "/practice/snbt/quantitative-knowledge"
    );

    expect(resolveHref("/en/practice/snbt/quantitative-knowledge", "id")).toBe(
      "/latihan/snbt/pengetahuan-kuantitatif"
    );
  });

  it("projects concrete practice set and question URLs without old split or mock route shapes", () => {
    expect(
      resolveHref(
        "/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1",
        "en"
      )
    ).toBe("/practice/snbt/quantitative-knowledge/tryout-2026/set-1");

    expect(
      resolveHref(
        "/id/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-1",
        "en"
      )
    ).toBe(
      "/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-1"
    );

    expect(
      resolveHref(
        "/en/practice/snbt/quantitative-knowledge/tryout-2026/set-1/question-1",
        "id"
      )
    ).toBe("/latihan/snbt/pengetahuan-kuantitatif/tryout-2026/set-1/soal-1");
  });

  it("keeps static app pages on normal localized path switching with safe state", () => {
    expect(resolveHref("/id/search?q=vektor#results", "en")).toBe(
      "/search?q=vektor#results"
    );

    expect(resolveHref("/en/home", "id")).toBe("/home");
    expect(resolveHref("/search?q=vektor", "en")).toBe("/search?q=vektor");
    expect(resolveHref("/id/search", "id")).toBe("/search");
    expect(resolveHref("/id", "en")).toBe("/");
    expect(resolveHref("/en", "id")).toBe("/");
  });

  it("fails expected projected-route misses instead of generating mixed-locale URLs", () => {
    const result = Effect.runSyncExit(
      resolveLocalizedNavigationHref({
        href: "/id/materi/fisika/tidak-ada",
        locale: "en",
      })
    );

    expect(result._tag).toBe("Failure");
  });

  it("fails malformed hrefs with a typed route-localization failure", () => {
    const result = Effect.runSyncExit(
      resolveLocalizedNavigationHref({
        href: "http://[",
        locale: "en",
      })
    );

    expect(result._tag).toBe("Failure");
  });

  it("fails projected routes when the target locale projection is missing", () => {
    const idOnlyRoute = readStaticPublicContentRoutes().find(
      (route) => route.publicPath === "materi/fisika/vektor/konsep-vektor"
    );

    expect(idOnlyRoute).toBeDefined();

    if (!idOnlyRoute) {
      throw new Error("Expected ID vector lesson route fixture");
    }

    const index: PublicLearningIndex = {
      projectMaterialContextToLocale: () => undefined,
      projectPracticeDomainPath: () => undefined,
      projectPracticeRootPath: () => undefined,
      projectRouteToLocale: () => undefined,
      resolveMaterialHeaderLink: () => undefined,
      resolveRouteByPath: () => idOnlyRoute,
      toContextualMaterialHref: preserveContextualHref,
    };

    vi.spyOn(
      publicLearningStatic,
      "loadStaticPublicLearningIndex"
    ).mockImplementation(() => Effect.succeed(index));

    const result = Effect.runSyncExit(
      resolveLocalizedNavigationHref({
        href: "/id/materi/fisika/vektor/konsep-vektor",
        locale: "en",
      })
    );

    expect(result._tag).toBe("Failure");
  });
});
