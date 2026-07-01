import { MATERIAL_CARD_DESCRIPTION_MAX_LENGTH } from "@repo/contents/_types/material/description";
import { describe, expect, it } from "vitest";
import {
  listCurriculumStaticParams,
  readCurriculumBreadcrumbs,
  readCurriculumHeaderLink,
  readCurriculumRootOptions,
  readCurriculumRouteModel,
  readCurriculumRoutes,
  readCurriculumTocHeader,
  readMaterialCardChapters,
  resolveCurriculumRoute,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/[curriculum]/[[...path]]/data";

/** Finds a renderable curriculum route fixture by its projected public path. */
function readRoute(publicPath: string, locale: "en" | "id" = "id") {
  const route = readCurriculumRoutes().find(
    (candidate) =>
      candidate.locale === locale && candidate.publicPath === publicPath
  );

  expect(route).toBeDefined();

  return route;
}

describe("curriculum route data", () => {
  it("builds static params for root and nested curriculum routes", () => {
    const params = listCurriculumStaticParams();

    expect(params).toContainEqual({ curriculum: "merdeka" });
    expect(params).toContainEqual({
      curriculum: "merdeka",
      path: ["kelas-10", "biologi"],
    });
    expect(params).not.toContainEqual({
      curriculum: "merdeka",
      path: ["kelas-1"],
    });
    expect(listCurriculumStaticParams("en")).toContainEqual({
      curriculum: "merdeka",
      path: ["class-10", "biology"],
    });
    expect(listCurriculumStaticParams("en")).not.toContainEqual({
      curriculum: "merdeka",
      path: ["kelas-10", "biologi"],
    });
  });

  it("resolves localized params through projected public paths", async () => {
    await expect(
      resolveCurriculumRoute(
        Promise.resolve({ curriculum: "merdeka", locale: "id" })
      )
    ).resolves.toMatchObject({
      locale: "id",
      route: {
        publicPath: "kurikulum/merdeka",
      },
    });

    await expect(
      resolveCurriculumRoute(
        Promise.resolve({
          curriculum: "merdeka",
          locale: "id",
          path: ["kelas-10", "biologi"],
        })
      )
    ).resolves.toMatchObject({
      route: {
        publicPath: "kurikulum/merdeka/kelas-10/biologi",
      },
    });
    await expect(
      resolveCurriculumRoute(
        Promise.resolve({
          curriculum: "merdeka",
          locale: "id",
          path: ["kelas-1"],
        })
      )
    ).rejects.toThrow();
    await expect(
      resolveCurriculumRoute(
        Promise.resolve({
          curriculum: "cambridge-international",
          locale: "en",
          path: ["upper-secondary", "igcse", "mathematics-0580"],
        })
      )
    ).rejects.toThrow();
    await expect(
      resolveCurriculumRoute(
        Promise.resolve({
          curriculum: "cambridge-international",
          locale: "en",
          path: ["upper-secondary", "mathematics-0580"],
        })
      )
    ).resolves.toMatchObject({
      route: {
        publicPath:
          "curriculum/cambridge-international/upper-secondary/mathematics-0580",
      },
    });

    await expect(
      resolveCurriculumRoute(
        Promise.resolve({ curriculum: "missing", locale: "id" })
      )
    ).rejects.toThrow();
    await expect(
      resolveCurriculumRoute(
        Promise.resolve({ curriculum: "merdeka", locale: "zz" })
      )
    ).rejects.toThrow();
  });

  it("keeps curriculum chooser rows title-only while material cards still render", () => {
    const merdekaRoot = readRoute("kurikulum/merdeka");
    const classRoute = readRoute("kurikulum/merdeka/kelas-10");
    const biology = readRoute("kurikulum/merdeka/kelas-10/biologi");

    if (!(merdekaRoot && classRoute && biology)) {
      return;
    }

    const rootChildren = readCurriculumRouteModel({
      locale: "id",
      route: merdekaRoot,
    }).childGroups.flatMap((group) => group.children);
    const subjectChildren = readCurriculumRouteModel({
      locale: "id",
      route: classRoute,
    }).childGroups.flatMap((group) => group.children);
    const biologyModel = readCurriculumRouteModel({
      locale: "id",
      route: biology,
    });

    expect(rootChildren.length).toBeGreaterThan(0);
    expect(rootChildren.map((child) => child.publicPath)).not.toContain(
      "kurikulum/merdeka/kelas-1"
    );
    expect(rootChildren.every((child) => !("description" in child))).toBe(true);
    expect(subjectChildren.length).toBeGreaterThan(0);
    expect(subjectChildren.every((child) => !("description" in child))).toBe(
      true
    );
    expect(biologyModel.materialCards.length).toBeGreaterThan(0);
    expect(
      biologyModel.materialCards.every(
        (card) =>
          !!card.description &&
          card.description.length <= MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
      )
    ).toBe(true);
    expect("headerDescription" in biologyModel).toBe(false);
  });

  it("builds localized root curriculum options with provider country metadata", () => {
    expect(readCurriculumRootOptions("id")).toEqual([
      {
        countryCode: "ID",
        href: "/id/kurikulum/merdeka",
        title: "Kurikulum Merdeka",
        value: "kurikulum/merdeka",
      },
      {
        countryCode: "GB",
        href: "/id/kurikulum/cambridge-international",
        title: "Cambridge International",
        value: "kurikulum/cambridge-international",
      },
      {
        countryCode: "SG",
        href: "/id/kurikulum/singapore-moe",
        title: "Singapore MOE",
        value: "kurikulum/singapore-moe",
      },
      {
        countryCode: "US",
        href: "/id/kurikulum/amerika-serikat",
        title: "United States Standards-Aligned Pathway",
        value: "kurikulum/amerika-serikat",
      },
    ]);
  });

  it("builds parent links, breadcrumbs, TOC headers, and material chapters", () => {
    const root = readRoute("kurikulum/merdeka");
    const classRoute = readRoute("kurikulum/merdeka/kelas-10");
    const biology = readRoute("kurikulum/merdeka/kelas-10/biologi");
    const englishMathematics = readRoute(
      "curriculum/merdeka/class-10/mathematics",
      "en"
    );
    const cambridgeMathematics = readRoute(
      "kurikulum/cambridge-international/upper-secondary/mathematics-0580"
    );

    if (
      !(
        root &&
        classRoute &&
        biology &&
        englishMathematics &&
        cambridgeMathematics
      )
    ) {
      return;
    }

    expect(readCurriculumHeaderLink("id", root)).toBeUndefined();
    expect(readCurriculumHeaderLink("id", classRoute)).toEqual({
      href: "/id/kurikulum/merdeka",
      label: "Kurikulum Merdeka",
    });
    expect(readCurriculumHeaderLink("en", classRoute)).toBeUndefined();
    expect(readCurriculumTocHeader("id", root)).toEqual({
      href: "/id/kurikulum/merdeka",
      title: "Kurikulum Merdeka",
    });
    expect(readCurriculumTocHeader("id", biology)).toEqual({
      description: "Kelas 10",
      href: "/id/kurikulum/merdeka/kelas-10/biologi",
      title: "Biologi",
    });
    expect(readCurriculumTocHeader("en", englishMathematics)).toEqual({
      description: "Class 10",
      href: "/en/curriculum/merdeka/class-10/mathematics",
      title: "Mathematics",
    });
    expect(readCurriculumTocHeader("id", cambridgeMathematics)).toEqual({
      description: "Upper Secondary",
      href: "/id/kurikulum/cambridge-international/upper-secondary/mathematics-0580",
      title: "Mathematics 0580",
    });
    expect(readCurriculumBreadcrumbs("Beranda", biology)).toEqual([
      { name: "Beranda", path: "" },
      { name: "Kurikulum Merdeka", path: "/kurikulum/merdeka" },
      { name: "Kelas 10", path: "/kurikulum/merdeka/kelas-10" },
      { name: "Biologi", path: "/kurikulum/merdeka/kelas-10/biologi" },
    ]);

    const model = readCurriculumRouteModel({ locale: "id", route: biology });

    expect(readMaterialCardChapters(model.materialCards)).toContainEqual({
      children: [],
      href: "#keanekaragaman-makhluk-hidup",
      label: "Keanekaragaman Makhluk Hidup",
    });
  });
});
