import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  findPublicContentRouteBySourcePath,
  isMaterialContentRoute,
  isMaterialLessonRoute,
  listPublicContentRoutes,
  readMaterialPagination,
  readParentMaterialRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import {
  comparePublicRouteOrder,
  makePath,
} from "@repo/contents/_types/route/path";
import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vitest";

describe("public content routes", () => {
  it("derives canonical subject routes from unified material sources", () => {
    const routes = Effect.runSync(listPublicContentRoutes());

    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "subject-topic",
        locale: "id",
        materialKey: "lesson.mathematics.integral",
        publicPath: "materi/matematika/integral",
        sitemap: false,
        sourcePath: "material/lesson/mathematics/integral",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "subject-lesson",
        locale: "id",
        materialKey: "lesson.mathematics.integral",
        publicPath: "materi/matematika/integral/jumlahan-riemann",
        sourcePath: "material/lesson/mathematics/integral/riemann-sum",
      })
    );
    expect(routes).toContainEqual(
      expect.objectContaining({
        kind: "subject-lesson",
        locale: "en",
        publicPath: "subjects/mathematics/integral/riemann-sum",
      })
    );
  });

  it("keeps material lesson order source-owned", () => {
    const routes = Effect.runSync(listPublicContentRoutes());
    const sequenceConcept = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath ===
          "materi/matematika/barisan-dan-deret/konsep-barisan"
    );
    const arithmeticSequence = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath ===
          "materi/matematika/barisan-dan-deret/barisan-aritmetika"
    );

    expect(sequenceConcept?.order).toBe(1);
    expect(arithmeticSequence?.order).toBe(2);
  });

  it("exposes canonical material helper contracts for app route composition", () => {
    const routes = Effect.runSync(listPublicContentRoutes());
    const topic = routes.find(
      (route) =>
        route.locale === "id" &&
        route.publicPath === "materi/matematika/barisan-dan-deret"
    );
    const lessons = routes
      .filter(
        (route) =>
          route.kind === "subject-lesson" &&
          route.locale === "id" &&
          route.parentPath === topic?.publicPath
      )
      .sort(comparePublicRouteOrder);
    const firstLesson = lessons[0];
    const secondLesson = lessons[1];

    expect(topic).toBeDefined();
    expect(firstLesson).toBeDefined();
    expect(secondLesson).toBeDefined();

    if (!(topic && firstLesson && secondLesson)) {
      return;
    }

    expect(isMaterialContentRoute(topic)).toBe(true);
    expect(isMaterialLessonRoute(topic)).toBe(false);
    expect(isMaterialLessonRoute(firstLesson)).toBe(true);
    expect(toLocalizedContentHref(firstLesson)).toBe(
      "/id/materi/matematika/barisan-dan-deret/konsep-barisan"
    );
    expect(readParentMaterialRoute(firstLesson, routes)).toMatchObject({
      publicPath: topic.publicPath,
    });
    expect(readParentMaterialRoute(topic, routes)).toBeUndefined();
    expect(comparePublicRouteOrder(secondLesson, firstLesson)).toBeGreaterThan(
      0
    );
    expect(
      comparePublicRouteOrder(
        {
          ...firstLesson,
          order: 1,
          publicPath: Effect.runSync(makePath(["b"])),
        },
        {
          ...secondLesson,
          order: 1,
          publicPath: Effect.runSync(makePath(["a"])),
        }
      )
    ).toBeGreaterThan(0);

    const firstPagination = readMaterialPagination(firstLesson, routes);
    const secondPagination = readMaterialPagination(secondLesson, routes);
    const topicPagination = readMaterialPagination(topic, routes);

    expect(firstPagination.prev).toEqual({ href: "", title: "" });
    expect(firstPagination.next.href).toBe(
      toLocalizedContentHref(secondLesson)
    );
    expect(secondPagination.prev.href).toBe(
      toLocalizedContentHref(firstLesson)
    );
    expect(
      readMaterialPagination(lessons.at(-1) ?? secondLesson, routes).next
    ).toEqual({ href: "", title: "" });
    expect(topicPagination).toEqual({
      next: { href: "", title: "" },
      prev: { href: "", title: "" },
    });
    expect(
      readMaterialPagination(
        { ...firstLesson, publicPath: Effect.runSync(makePath(["missing"])) },
        routes
      )
    ).toEqual({
      next: { href: "", title: "" },
      prev: { href: "", title: "" },
    });
  });

  it("finds public content routes by source path", () => {
    const routeBySourcePath = Effect.runSync(
      findPublicContentRouteBySourcePath(
        "material/lesson/mathematics/integral/riemann-sum",
        "id"
      )
    );

    expect(Option.isSome(routeBySourcePath)).toBe(true);
    expect(Option.getOrNull(routeBySourcePath)).toMatchObject({
      kind: "subject-lesson",
      publicPath: "materi/matematika/integral/jumlahan-riemann",
    });
  });

  it("returns none for missing public content route lookups", () => {
    expect(
      Option.isNone(
        Effect.runSync(
          findPublicContentRouteBySourcePath(
            "material/lesson/mathematics/missing",
            "id"
          )
        )
      )
    ).toBe(true);
  });

  it("fails with typed errors when source slugs are missing", () => {
    const exit = Effect.runSyncExit(
      listPublicContentRoutes({
        domains: MATERIAL_ROUTE_DOMAINS.filter(
          (domain) =>
            !(domain.kind === "lesson" && domain.domain === "mathematics")
        ),
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("fails with typed errors when two generated routes collide", () => {
    const firstLesson = MATERIAL_SOURCES.find(
      (material) => material.kind === "lesson"
    );

    if (!firstLesson) {
      expect(firstLesson).toBeDefined();
      return;
    }

    const exit = Effect.runSyncExit(
      listPublicContentRoutes({
        materials: [firstLesson, firstLesson],
      })
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
