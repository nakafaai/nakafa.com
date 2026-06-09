// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentExerciseMaterial,
  getCurrentSubjectMaterial,
  getRuntimeArticleSummaries,
  getRuntimeExerciseMaterials,
  getRuntimeExerciseSubjects,
  getRuntimeGradeSubjects,
  getRuntimeSubjectGrades,
  getRuntimeSubjectMaterials,
} from "@/lib/content/navigation";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRouteKindPage: vi.fn(),
  getRuntimeContentRouteParentPage: vi.fn(),
}));

vi.mock("@/lib/content/runtime", () => ({
  getRuntimeContentRouteKindPage: runtimeMocks.getRuntimeContentRouteKindPage,
  getRuntimeContentRouteParentPage:
    runtimeMocks.getRuntimeContentRouteParentPage,
}));

interface NavigationRoute {
  authors: Array<{ name: string }>;
  content_id: string;
  date?: number;
  depth?: number;
  description?: string;
  kind:
    | "article"
    | "subject-topic"
    | "subject-section"
    | "exercise-group"
    | "exercise-set"
    | "exercise-question"
    | "quran-surah";
  locale: "en" | "id";
  markdown: boolean;
  official?: boolean;
  parentRoute?: string;
  route: string;
  section: "articles" | "subject" | "exercises" | "quran";
  syncedAt: number;
  title: string;
}

const routes = [
  routeRow({
    authors: [{ name: "Nabil Akbarazzima Fatih" }],
    date: 1_735_689_600_000,
    official: false,
    route: "articles/politics/official-author-but-row-false",
    title: "Official Author But Row False",
  }),
  routeRow({
    authors: [{ name: "Contributor" }],
    date: 1_735_776_000_000,
    official: true,
    route: "articles/politics/row-true",
    title: "Row True",
  }),
  routeRow({
    date: undefined,
    route: "articles/politics/no-date",
    title: "No Date",
  }),
  routeRow({
    description: undefined,
    official: undefined,
    route: "articles/politics/default-fallbacks",
    title: "Default Fallbacks",
  }),
  routeRow({
    route: "articles/politics/row-true/child",
    title: "Nested Article Child",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    section: "exercises",
    title: "Try Out UTBK 2026",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    section: "exercises",
    title: "Duplicate Try Out UTBK 2026",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge",
    section: "exercises",
    title: "Invalid Base Exercise Group",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge/empty-group",
    section: "exercises",
    title: "Empty Group",
  }),
  routeRow({
    kind: "exercise-set",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    section: "exercises",
    title: "Set 1",
  }),
  routeRow({
    kind: "exercise-set",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-10",
    section: "exercises",
    title: "Set 10",
  }),
  routeRow({
    kind: "exercise-set",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
    section: "exercises",
    title: "Set 2",
  }),
  routeRow({
    kind: "exercise-question",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/1",
    section: "exercises",
    title: "Question 1",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/mathematics/practice",
    section: "exercises",
    title: "Practice",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/unsupported-material/practice",
    section: "exercises",
    title: "Unsupported Material",
  }),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics/function-transformation",
    section: "subject",
    title: "Transformasi Fungsi",
  }),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics",
    section: "subject",
    title: "Invalid Base Subject Topic",
  }),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics/function-transformation",
    section: "subject",
    title: "Duplicate Transformasi Fungsi",
  }),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics/empty-topic",
    section: "subject",
    title: "Topik Kosong",
  }),
  routeRow({
    kind: "subject-section",
    route:
      "subject/high-school/12/mathematics/function-transformation/translation",
    section: "subject",
    title: "Translasi Grafik",
  }),
] satisfies NavigationRoute[];

beforeEach(() => {
  runtimeMocks.getRuntimeContentRouteKindPage.mockReset();
  runtimeMocks.getRuntimeContentRouteParentPage.mockReset();
  runtimeMocks.getRuntimeContentRouteKindPage.mockImplementation(
    (args: RuntimeKindListArgs) =>
      Effect.succeed(routePage(getMatchingKindRows(routes, args), args.limit))
  );
  runtimeMocks.getRuntimeContentRouteParentPage.mockImplementation(
    (args: RuntimeListArgs) =>
      Effect.succeed(routePage(getMatchingRows(routes, args), args.limit))
  );
});

/** Builds one completed route-catalog page fixture. */
function routePage(page: NavigationRoute[], limit = 100) {
  return {
    continueCursor: page.length > limit ? "next-page" : "",
    isDone: page.length <= limit,
    page: page.slice(0, limit),
  };
}

describe("content navigation runtime catalog", () => {
  it("uses the Convex route official flag for article summaries", async () => {
    const articles = await Effect.runPromise(
      getRuntimeArticleSummaries("politics", "id")
    );

    expect(articles).toEqual([
      {
        date: new Date(1_735_776_000_000).toISOString(),
        description: "Description",
        official: true,
        slug: "row-true",
        title: "Row True",
      },
      {
        date: new Date(1_735_689_600_000).toISOString(),
        description: "Description",
        official: false,
        slug: "official-author-but-row-false",
        title: "Official Author But Row False",
      },
      {
        date: new Date(1_735_689_600_000).toISOString(),
        description: "",
        official: false,
        slug: "default-fallbacks",
        title: "Default Fallbacks",
      },
    ]);
    expect(runtimeMocks.getRuntimeContentRouteParentPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "article",
      limit: 100,
      locale: "id",
      order: "date-desc",
      parentRoute: "articles/politics",
      section: "articles",
    });
  });

  it("lists exercise materials from route-catalog rows", async () => {
    const subjects = await Effect.runPromise(
      getRuntimeExerciseSubjects("high-school", "snbt", "id")
    );

    expect(subjects).toEqual([
      {
        href: "/exercises/high-school/snbt/mathematics",
        label: "mathematics",
      },
      {
        href: "/exercises/high-school/snbt/quantitative-knowledge",
        label: "quantitative-knowledge",
      },
    ]);
  });

  it("lists subject grades from bounded Convex route probes", async () => {
    const grades = await Effect.runPromise(getRuntimeSubjectGrades("id"));

    expect(grades).toEqual([
      {
        category: "high-school",
        grade: "12",
        href: "/subject/high-school/12",
      },
    ]);
    expect(runtimeMocks.getRuntimeContentRouteKindPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "subject-topic",
      limit: 1,
      locale: "id",
      prefix: "subject/high-school/12",
      section: "subject",
    });
  });

  it("lists subject material links from bounded parent route probes", async () => {
    const subjects = await Effect.runPromise(
      getRuntimeGradeSubjects("high-school", "12", "id")
    );

    expect(subjects).toEqual([
      {
        href: "/subject/high-school/12/mathematics",
        label: "mathematics",
      },
    ]);
    expect(runtimeMocks.getRuntimeContentRouteParentPage).toHaveBeenCalledWith({
      cursor: null,
      kind: "subject-topic",
      limit: 1,
      locale: "id",
      order: "route",
      parentRoute: "subject/high-school/12/mathematics",
      section: "subject",
    });
  });

  it("keeps localized exercise group labels from synced group rows", async () => {
    const materials = await Effect.runPromise(
      getRuntimeExerciseMaterials(
        "/exercises/high-school/snbt/quantitative-knowledge",
        "id"
      )
    );

    expect(materials).toEqual([
      {
        description: "Description",
        href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
        items: [
          {
            href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
            title: "Set 1",
          },
          {
            href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-2",
            title: "Set 2",
          },
          {
            href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-10",
            title: "Set 10",
          },
        ],
        title: "Try Out UTBK 2026",
      },
    ]);

    expect(
      getCurrentExerciseMaterial(materials[0]?.href ?? "", materials)
    ).toMatchObject({
      currentMaterial: { _tag: "Some" },
      currentMaterialItem: { _tag: "None" },
    });
    expect(
      getCurrentExerciseMaterial(materials[0]?.items[0]?.href ?? "", materials)
    ).toMatchObject({
      currentMaterial: { _tag: "Some" },
      currentMaterialItem: { _tag: "Some" },
    });
    expect(getCurrentExerciseMaterial("/missing", materials)).toMatchObject({
      currentMaterial: { _tag: "None" },
      currentMaterialItem: { _tag: "None" },
    });
  });

  it("keeps localized subject topic labels from synced topic rows", async () => {
    const materials = await Effect.runPromise(
      getRuntimeSubjectMaterials("subject/high-school/12/mathematics", "id")
    );

    expect(materials).toEqual([
      {
        description: "Description",
        href: "/subject/high-school/12/mathematics/function-transformation",
        items: [
          {
            href: "/subject/high-school/12/mathematics/function-transformation/translation",
            title: "Translasi Grafik",
          },
        ],
        title: "Transformasi Fungsi",
      },
    ]);

    expect(
      getCurrentSubjectMaterial(materials[0]?.href ?? "", materials)
    ).toMatchObject({
      currentChapter: { _tag: "Some" },
      currentItem: { _tag: "None" },
    });
    expect(
      getCurrentSubjectMaterial(materials[0]?.items[0]?.href ?? "", materials)
    ).toMatchObject({
      currentChapter: { _tag: "Some" },
      currentItem: { _tag: "Some" },
    });
    expect(getCurrentSubjectMaterial("/missing", materials)).toMatchObject({
      currentChapter: { _tag: "None" },
      currentItem: { _tag: "None" },
    });
  });

  it("does not expose item rows when their group rows are absent", async () => {
    runtimeMocks.getRuntimeContentRouteParentPage.mockImplementation(
      (args: RuntimeListArgs) =>
        Effect.succeed(
          routePage(getMatchingRows(missingGroupRows, args), args.limit)
        )
    );

    await expect(
      Effect.runPromise(
        getRuntimeSubjectMaterials("subject/high-school/12/mathematics", "id")
      )
    ).resolves.toEqual([]);
    await expect(
      Effect.runPromise(
        getRuntimeExerciseMaterials(
          "exercises/high-school/snbt/quantitative-knowledge",
          "id"
        )
      )
    ).resolves.toEqual([]);
  });

  it("fails when child rows point at a missing synced group row", async () => {
    runtimeMocks.getRuntimeContentRouteParentPage.mockImplementation(
      (args: RuntimeListArgs) => {
        if (args.kind === "exercise-group") {
          return Effect.succeed(
            routePage(
              corruptExerciseRows.filter((row) => row.kind === args.kind),
              args.limit
            )
          );
        }

        if (args.kind === "exercise-set") {
          return Effect.succeed(
            routePage(
              corruptExerciseRows.filter((row) => row.kind === args.kind),
              args.limit
            )
          );
        }

        if (args.kind === "subject-topic") {
          return Effect.succeed(
            routePage(
              corruptSubjectRows.filter((row) => row.kind === args.kind),
              args.limit
            )
          );
        }

        if (args.kind === "subject-section") {
          return Effect.succeed(
            routePage(
              corruptSubjectRows.filter((row) => row.kind === args.kind),
              args.limit
            )
          );
        }

        return Effect.succeed(routePage([], args.limit));
      }
    );

    await expect(
      Effect.runPromise(
        getRuntimeExerciseMaterials(
          "exercises/high-school/snbt/quantitative-knowledge",
          "id"
        )
      )
    ).rejects.toThrow("Synced exercise set is missing group navigation row");
    await expect(
      Effect.runPromise(
        getRuntimeSubjectMaterials("subject/high-school/12/mathematics", "id")
      )
    ).rejects.toThrow("Synced subject section is missing topic navigation row");
  });

  it("ignores malformed group rows outside the requested material scope", async () => {
    runtimeMocks.getRuntimeContentRouteParentPage.mockImplementation(
      (args: RuntimeListArgs) =>
        Effect.succeed(
          routePage(getMatchingRows(malformedGroupRows, args), args.limit)
        )
    );

    await expect(
      Effect.runPromise(
        getRuntimeSubjectMaterials("subject/high-school/12/mathematics", "id")
      )
    ).resolves.toHaveLength(1);
    await expect(
      Effect.runPromise(
        getRuntimeExerciseMaterials(
          "exercises/high-school/snbt/quantitative-knowledge",
          "id"
        )
      )
    ).resolves.toHaveLength(1);
  });

  it("keeps navigation bounded when matching route pages report more rows", async () => {
    runtimeMocks.getRuntimeContentRouteParentPage.mockImplementation(
      (args: RuntimeListArgs) =>
        Effect.succeed(
          routePage(getMatchingRows(overflowRoutes, args), args.limit)
        )
    );

    await expect(
      Effect.runPromise(getRuntimeArticleSummaries("politics", "id"))
    ).resolves.toHaveLength(100);
    await expect(
      Effect.runPromise(
        getRuntimeExerciseMaterials(
          "exercises/high-school/snbt/quantitative-knowledge",
          "id"
        )
      )
    ).resolves.toEqual([
      {
        description: "Description",
        href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
        items: [
          {
            href: "/exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
            title: "Set 1",
          },
        ],
        title: "Try Out UTBK 2026",
      },
    ]);
    await expect(
      Effect.runPromise(
        getRuntimeSubjectMaterials("subject/high-school/12/mathematics", "id")
      )
    ).resolves.toEqual([
      {
        description: "Description",
        href: "/subject/high-school/12/mathematics/function-transformation",
        items: [
          {
            href: "/subject/high-school/12/mathematics/function-transformation/translation",
            title: "Translasi Grafik",
          },
        ],
        title: "Transformasi Fungsi",
      },
    ]);
  });
});

interface RuntimeListArgs {
  kind: NavigationRoute["kind"];
  limit: number;
  locale: "en" | "id";
  order: "date-desc" | "route";
  parentRoute: string;
  section: "articles" | "subject" | "exercises" | "quran";
}

interface RuntimeKindListArgs {
  kind: NavigationRoute["kind"];
  limit: number;
  locale: "en" | "id";
  prefix: string;
  section: "articles" | "subject" | "exercises" | "quran";
}

const overflowRoutes = [
  ...Array.from({ length: 150 }, (_, index) =>
    routeRow({
      date: 1_735_689_600_000 + index,
      route: `articles/politics/article-${index.toString().padStart(3, "0")}`,
      title: `Article ${index}`,
    })
  ),
  ...Array.from({ length: 150 }, (_, index) =>
    routeRow({
      kind: "exercise-question",
      route: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1/${index + 1}`,
      parentRoute:
        "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
      section: "exercises",
      title: `Question ${index + 1}`,
    })
  ),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    section: "exercises",
    title: "Try Out UTBK 2026",
  }),
  routeRow({
    kind: "exercise-set",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    section: "exercises",
    title: "Set 1",
  }),
  ...Array.from({ length: 150 }, (_, index) =>
    routeRow({
      kind: "subject-section",
      route: `subject/high-school/12/mathematics/overflow-topic/lesson-${index}`,
      parentRoute: "subject/high-school/12/mathematics/overflow-topic",
      section: "subject",
      title: `Overflow Lesson ${index}`,
    })
  ),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics/function-transformation",
    section: "subject",
    title: "Transformasi Fungsi",
  }),
  routeRow({
    kind: "subject-section",
    route:
      "subject/high-school/12/mathematics/function-transformation/translation",
    section: "subject",
    title: "Translasi Grafik",
  }),
] satisfies NavigationRoute[];

const missingGroupRows = [
  routeRow({
    kind: "subject-section",
    route: "subject/high-school/12/mathematics/missing/lesson",
    section: "subject",
    title: "Missing Topic Lesson",
  }),
  routeRow({
    kind: "exercise-set",
    route: "exercises/high-school/snbt/quantitative-knowledge/missing/set-1",
    section: "exercises",
    title: "Missing Group Set",
  }),
] satisfies NavigationRoute[];

const malformedGroupRows = [
  routeRow({
    kind: "subject-topic",
    parentRoute: "subject/high-school/12/mathematics",
    route: "subject/high-school/12/physics/waves",
    section: "subject",
    title: "Wrong Subject Parent",
  }),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics",
    section: "subject",
    title: "Invalid Subject Base",
  }),
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics/function-transformation",
    section: "subject",
    title: "Transformasi Fungsi",
  }),
  routeRow({
    kind: "subject-section",
    route:
      "subject/high-school/12/mathematics/function-transformation/translation",
    section: "subject",
    title: "Translasi Grafik",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge",
    section: "exercises",
    title: "Invalid Exercise Base",
  }),
  routeRow({
    kind: "exercise-group",
    parentRoute: "exercises/high-school/snbt/quantitative-knowledge",
    route: "exercises/high-school/snbt/mathematics/practice",
    section: "exercises",
    title: "Wrong Exercise Parent",
  }),
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    section: "exercises",
    title: "Try Out UTBK 2026",
  }),
  routeRow({
    kind: "exercise-set",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/set-1",
    section: "exercises",
    title: "Set 1",
  }),
] satisfies NavigationRoute[];

const corruptExerciseRows = [
  routeRow({
    kind: "exercise-group",
    route: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026",
    section: "exercises",
    title: "Try Out UTBK 2026",
  }),
  routeRow({
    kind: "exercise-set",
    parentRoute:
      "exercises/high-school/snbt/quantitative-knowledge/missing-group",
    route:
      "exercises/high-school/snbt/quantitative-knowledge/missing-group/set-1",
    section: "exercises",
    title: "Missing Group Set",
  }),
] satisfies NavigationRoute[];

const corruptSubjectRows = [
  routeRow({
    kind: "subject-topic",
    route: "subject/high-school/12/mathematics/function-transformation",
    section: "subject",
    title: "Transformasi Fungsi",
  }),
  routeRow({
    kind: "subject-section",
    parentRoute: "subject/high-school/12/mathematics/missing-topic",
    route: "subject/high-school/12/mathematics/missing-topic/lesson",
    section: "subject",
    title: "Missing Topic Lesson",
  }),
] satisfies NavigationRoute[];

/** Selects one bounded kind-scoped route page for navigation tests. */
function getMatchingRows(
  rows: readonly NavigationRoute[],
  args: RuntimeListArgs
) {
  return rows.filter(
    (route) =>
      route.kind === args.kind &&
      route.locale === args.locale &&
      route.parentRoute === args.parentRoute &&
      route.section === args.section &&
      route.route !== args.parentRoute
  );
}

/** Selects one bounded kind-prefix route page for navigation tests. */
function getMatchingKindRows(
  rows: readonly NavigationRoute[],
  args: RuntimeKindListArgs
) {
  return rows.filter(
    (route) =>
      route.kind === args.kind &&
      route.locale === args.locale &&
      route.section === args.section &&
      route.route.startsWith(`${args.prefix}/`)
  );
}

/** Builds one route-catalog row for navigation tests. */
function routeRow(overrides: Partial<NavigationRoute>): NavigationRoute {
  const route = overrides.route ?? "articles/politics/default";
  const locale = overrides.locale ?? "id";

  return {
    authors: [{ name: "Contributor" }],
    content_id: `${locale}/${route}`,
    date: 1_735_689_600_000,
    depth: route.split("/").filter(Boolean).length,
    description: "Description",
    kind: "article",
    locale,
    markdown: true,
    parentRoute: getFixtureParentRoute(overrides.kind ?? "article", route),
    route,
    section: "articles",
    syncedAt: 1,
    title: "Title",
    ...overrides,
  };
}

/** Derives the same navigation parent route used by synced route rows. */
function getFixtureParentRoute(kind: NavigationRoute["kind"], route: string) {
  const parts = route.split("/").filter(Boolean);

  if (kind === "article") {
    return parts.slice(0, 2).join("/");
  }

  if (kind === "exercise-group" || kind === "subject-topic") {
    return parts.slice(0, 4).join("/");
  }

  if (kind === "quran-surah") {
    return "quran";
  }

  return parts.slice(0, -1).join("/");
}
