import { MATERIAL_CARD_DESCRIPTION_MAX_LENGTH } from "@repo/contents/_types/material/description";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import {
  readCurriculumMaterialCards,
  readCurriculumMaterialPaths,
} from "@repo/contents/_types/route/curriculum/card";
import {
  PublicMaterialLessonRouteSchema,
  PublicMaterialTopicRouteSchema,
} from "@repo/contents/_types/route/schema";
import { PublicRoutePathSchema } from "@repo/contents/_types/route/segment";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

const INDONESIAN_BIOLOGY_MATERIAL_HREF_PATTERN = /^\/id\/materi\/biologi\//;
const FUNCTION_MATERIAL_KEY =
  "lesson.mathematics.function-composition-inverse-function";

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
    expect(
      readCurriculumMaterialPaths(subjectRoute, curriculumRoutes)
    ).toContain(materialRoute.canonicalPath);
    expect(readCurriculumMaterialPaths(classRoute, curriculumRoutes)).toEqual(
      []
    );

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

  it("keeps source siblings beside one exact lesson moved to another topic", () => {
    const contentRoutes = Effect.runSync(listPublicContentRoutes());
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const materialRoute = curriculumRoutes.find(
      (route) =>
        route.locale === "en" && route.materialKey === FUNCTION_MATERIAL_KEY
    );
    const topicRoute = contentRoutes.find(
      (route) =>
        route.kind === "subject-topic" &&
        route.locale === "en" &&
        route.materialKey === FUNCTION_MATERIAL_KEY
    );
    const sourceLessons = contentRoutes.filter(
      (route) =>
        route.kind === "subject-lesson" &&
        route.locale === "en" &&
        route.materialKey === FUNCTION_MATERIAL_KEY
    );
    const unitRoute = curriculumRoutes.find(
      (route) => route.publicPath === materialRoute?.parentPath
    );
    const subjectRoute = curriculumRoutes.find(
      (route) => route.publicPath === unitRoute?.parentPath
    );

    expect(materialRoute).toBeDefined();
    expect(topicRoute).toBeDefined();
    expect(sourceLessons.length).toBeGreaterThan(1);
    expect(unitRoute).toBeDefined();
    expect(subjectRoute).toBeDefined();

    const movedSource = sourceLessons[0];
    const retainedSource = sourceLessons[1];
    if (
      !(
        materialRoute &&
        topicRoute &&
        movedSource &&
        retainedSource &&
        unitRoute &&
        subjectRoute
      )
    ) {
      return;
    }

    const movedParentPath = Schema.decodeUnknownSync(PublicRoutePathSchema)(
      `${topicRoute.publicPath}-published`
    );
    const movedTopic = Schema.decodeUnknownSync(PublicMaterialTopicRouteSchema)(
      {
        ...topicRoute,
        publicPath: movedParentPath,
      }
    );
    const movedLesson = Schema.decodeUnknownSync(
      PublicMaterialLessonRouteSchema
    )({
      ...movedSource,
      parentPath: movedParentPath,
      publicPath: `${movedParentPath}/${movedSource.publicPath.slice(
        movedSource.publicPath.lastIndexOf("/") + 1
      )}`,
    });
    const partialRoutes = [
      ...contentRoutes.filter(
        (route) =>
          !(
            route.locale === movedSource.locale &&
            route.sourcePath === movedSource.sourcePath
          )
      ),
      movedTopic,
      movedLesson,
    ];

    const cards = readCurriculumMaterialCards({
      contentRoutes: partialRoutes,
      curriculumRoutes,
      route: subjectRoute,
    });
    const items = cards.flatMap((card) => card.items);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: expect.stringContaining(
            `/${movedLesson.locale}/${movedLesson.publicPath}?ctx=`
          ),
          title: movedLesson.title,
        }),
        expect.objectContaining({
          href: expect.stringContaining(
            `/${retainedSource.locale}/${retainedSource.publicPath}?ctx=`
          ),
          title: retainedSource.title,
        }),
      ])
    );
  });
});
