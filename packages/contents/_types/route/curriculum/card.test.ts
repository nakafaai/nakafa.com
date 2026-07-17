import { MATERIAL_CARD_DESCRIPTION_MAX_LENGTH } from "@repo/contents/_types/material/description";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import { readCurriculumMaterialCards } from "@repo/contents/_types/route/curriculum/card";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN = /^\/id\/materi\/biologi\//;

describe("curriculum cards", () => {
  it("builds localized cards with direct canonical lesson links", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const classRoute = curriculumRoutes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/merdeka/kelas-10"
    );
    const subjectRoute = curriculumRoutes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "kurikulum/merdeka/kelas-10/biologi"
    );
    const unitRoute = curriculumRoutes.find(
      (route) =>
        route.locale === "id" &&
        route.parentPath === subjectRoute?.publicPath &&
        route.level === "unit"
    );
    const materialRoute = curriculumRoutes.find(
      (route) =>
        route.locale === "id" &&
        route.parentPath === unitRoute?.publicPath &&
        route.materialKey !== undefined
    );

    expect(classRoute).toBeDefined();
    expect(subjectRoute).toBeDefined();
    expect(unitRoute).toBeDefined();
    expect(materialRoute).toBeDefined();

    if (!(classRoute && subjectRoute && unitRoute && materialRoute)) {
      return;
    }

    const cards = readCurriculumMaterialCards({
      contentRoutes,
      curriculumRoutes,
      route: subjectRoute,
    });

    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0]?.items[0]?.href).toMatch(
      INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN
    );
    expect(cards[0]?.description?.length).toBeLessThanOrEqual(
      MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
    );
    expect(
      readCurriculumMaterialCards({
        contentRoutes,
        curriculumRoutes,
        route: classRoute,
      })
    ).toEqual([]);
    expect(
      readCurriculumMaterialCards({
        contentRoutes: [],
        curriculumRoutes,
        route: subjectRoute,
      })
    ).toEqual([]);

    const lesson = contentRoutes.find(
      (route) =>
        route.kind === "subject-lesson" &&
        route.locale === materialRoute.locale &&
        route.parentPath === materialRoute.canonicalPath
    );

    expect(lesson).toBeDefined();

    if (!lesson) {
      return;
    }

    const concreteCards = readCurriculumMaterialCards({
      contentRoutes,
      curriculumRoutes: [
        subjectRoute,
        unitRoute,
        { ...materialRoute, canonicalPath: lesson.publicPath },
      ],
      route: subjectRoute,
    });

    expect(concreteCards).toHaveLength(1);
    expect(concreteCards[0]).toMatchObject({
      href: expect.stringContaining(
        `/${lesson.locale}/${lesson.publicPath}?ctx=`
      ),
      items: [
        {
          href: expect.stringContaining(
            `/${lesson.locale}/${lesson.publicPath}?ctx=`
          ),
          title: lesson.title,
        },
      ],
      title: unitRoute.materialCardTitle,
    });
  });

  it("uses concise curriculum-owned copy for every rendered card", () => {
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const programKeys = new Set<string>();

    for (const route of curriculumRoutes) {
      const cards = readCurriculumMaterialCards({
        contentRoutes,
        curriculumRoutes,
        route,
      });

      if (cards.length === 0) {
        continue;
      }

      programKeys.add(route.programKey);

      for (const card of cards) {
        const sourceRoute = curriculumRoutes.find(
          (candidate) =>
            candidate.locale === route.locale &&
            candidate.parentPath === route.publicPath &&
            candidate.materialCardTitle === card.title
        );

        expect(sourceRoute).toMatchObject({
          level: "unit",
          materialCardDescription: card.description,
          materialCardTitle: card.title,
          materialKey: undefined,
        });
        expect(card.description.trim()).toBe(card.description);
        expect(card.description.length).toBeGreaterThan(0);
        expect(card.description.length).toBeLessThanOrEqual(
          MATERIAL_CARD_DESCRIPTION_MAX_LENGTH
        );
      }
    }

    expect(programKeys).toEqual(
      new Set([
        "cambridge-international",
        "merdeka",
        "singapore-moe",
        "united-states",
      ])
    );
  });
});
