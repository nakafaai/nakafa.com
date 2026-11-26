import { describe, expect, it } from "@effect/vitest";
import { isGoneAddress } from "@/lib/routing/public/gone";

describe("gone addresses", () => {
  it("answers the retired families that Search Console listed as not found, with or without a locale", () => {
    for (const pathname of [
      "/id/latihan/snbt/penalaran-matematika/tryout-2026/set-6/soal-2",
      "/id/exercises/high-school/snbt/general-reasoning/try-out/set-8/13",
      "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2/4",
      "/en/practice/snbt/general-reasoning/tryout-2026/set-9/question-19",
      "/en/subject/high-school/11/sociology",
      "/subject/high-school/12/economy/accounting",
      "/id/subject/high-school/11/chemistry/kinetic-chemistry/collision-theory",
      "/ask/pork-barrel-politics-definition-indonesia-examples",
      "/id/ask/what-is-a-unit-vector-and-its-purpose",
      "/ask/how-to-create-a-new-quadratic-equation-from-its-roots.md",
      "/island",
      "/id/island",
      "/en/island/nabil",
    ]) {
      expect(isGoneAddress(pathname), pathname).toBe(true);
    }
  });

  it("answers the retired framework's assets and the hashed sitemap shards", () => {
    expect(isGoneAddress("/_next/static/chunks/3xc9qzq3o8j5g.js")).toBe(true);
    expect(isGoneAddress("/sitemap/material_id_f29.xml")).toBe(true);
    expect(isGoneAddress("/sitemap/program_de_829.xml")).toBe(true);
  });

  it("keeps every live page and the live sitemaps", () => {
    for (const pathname of [
      "/",
      "/id",
      "/id/materi/matematika/geometri-analitik/elips",
      "/en/subjects/mathematics/analytic-geometry/ellipse",
      "/de/faecher/mathematik/funktionen-und-modelle/exponentialfunktion",
      "/id/try-out/indonesia/snbt/2027/utbk/set-4",
      "/sitemap.xml",
      "/sitemap/material_id_p10.xml",
      "/sitemap/base.xml",
      "/sitemap/material_id_f29.xml/extra",
    ]) {
      expect(isGoneAddress(pathname), pathname).toBe(false);
    }
  });
});
