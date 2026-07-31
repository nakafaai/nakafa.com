// @vitest-environment node

import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import { PublicMaterialTopicRouteSchema } from "@repo/contents/_types/route/schema";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { MaterialSourceModel } from "@/lib/content/material/ownership";
import {
  readMaterialSourceCandidates,
  reconcileMaterialCurriculumRoutes,
  reconcileMaterialSourceRoutes,
} from "@/lib/content/material/source";
import {
  makeMaterialGraph,
  makePreviewPublicRoute,
  previewIdProjection,
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";

const sourceRoute = makePreviewPublicRoute(previewProjection, {
  publicPath:
    "subjects/mathematics/function-composition-inverse-function/old-function-concept",
});
const nextRoute = makePreviewPublicRoute(previewNextProjection);
const idRoute = makePreviewPublicRoute(previewIdProjection);
const topicRoute = Schema.decodeUnknownSync(PublicMaterialTopicRouteSchema)({
  ...sourceRoute,
  kind: "subject-topic",
  publicPath: sourceRoute.parentPath,
  sourcePath:
    "material/lesson/mathematics/function-composition-inverse-function",
});

describe("material source reconciliation", () => {
  it("extracts exact lesson identities from canonical curriculum paths", () => {
    expect(
      readMaterialSourceCandidates(
        [
          topicRoute.publicPath,
          sourceRoute.publicPath,
          idRoute.publicPath,
          "subjects/mathematics/missing",
        ],
        "en",
        [sourceRoute, idRoute, topicRoute]
      )
    ).toEqual([
      {
        contentKey: sourceRoute.sourcePath,
        locale: "en",
        parentPath: sourceRoute.parentPath,
      },
    ]);
  });

  it("keeps an empty source topic as a published-group anchor", () => {
    expect(
      readMaterialSourceCandidates([topicRoute.publicPath], "en", [topicRoute])
    ).toEqual([
      {
        contentKey: topicRoute.sourcePath,
        locale: "en",
        parentPath: topicRoute.publicPath,
      },
    ]);
  });

  it("replaces found claims, removes tombstones, and preserves unclaimed routes", async () => {
    await expect(
      Effect.runPromise(
        reconcileMaterialSourceRoutes(
          "en",
          [topicRoute, sourceRoute, nextRoute, idRoute],
          {
            claims: [
              {
                contentKey: previewProjection.contentKey,
                kind: "found",
                locale: "en",
                projection: previewProjection,
              },
              {
                contentKey: previewNextProjection.contentKey,
                kind: "missing",
                locale: "en",
              },
            ],
            materials: [previewProjection, previewIdProjection],
          }
        )
      )
    ).resolves.toEqual([
      topicRoute,
      idRoute,
      makePreviewPublicRoute(previewProjection),
    ]);
  });

  it("uses the synchronous Effect fast path required by static prerender", () => {
    const dateNow = vi.spyOn(Date, "now");
    const result = Effect.runSync(
      reconcileMaterialSourceRoutes("en", [sourceRoute], {
        claims: [],
        materials: [],
      })
    );
    const dateNowCalls = dateNow.mock.calls.length;
    dateNow.mockRestore();

    expect(result).toEqual([sourceRoute]);
    expect(dateNowCalls).toBe(0);
  });

  it("updates and removes concrete curriculum paths with exact claims", () => {
    const curriculumRoutes = Effect.runSync(listPublicCurriculumRoutes());
    const curriculumRoute = curriculumRoutes.find(
      (route) => route.locale === sourceRoute.locale
    );
    if (!curriculumRoute) {
      expect.fail("Expected one English curriculum route.");
    }
    const concrete = {
      ...curriculumRoute,
      canonicalPath: sourceRoute.publicPath,
    };
    const renamedPath = PublicPathSchema.make(
      `${sourceRoute.parentPath}/renamed`
    );
    const projection = {
      ...previewProjection,
      contentKey: ContentKeySchema.make(sourceRoute.sourcePath),
      locale: sourceRoute.locale,
      publicPath: renamedPath,
    };
    const reconciled = Effect.runSync(
      reconcileMaterialSourceRoutes(sourceRoute.locale, [sourceRoute], {
        claims: [
          {
            contentKey: projection.contentKey,
            kind: "found",
            locale: projection.locale,
            projection,
          },
        ],
        materials: [],
      })
    );
    const renamed = Effect.runSync(
      reconcileMaterialCurriculumRoutes([concrete], [sourceRoute], reconciled, {
        claims: [
          {
            contentKey: projection.contentKey,
            kind: "found",
            locale: projection.locale,
            projection,
          },
        ],
        materials: [],
      })
    );
    const removed = Effect.runSync(
      reconcileMaterialCurriculumRoutes(
        [concrete],
        [sourceRoute],
        [sourceRoute],
        {
          claims: [
            {
              contentKey: projection.contentKey,
              kind: "missing",
              locale: projection.locale,
            },
          ],
          materials: [],
        }
      )
    );

    expect(
      renamed.find((route) => route.publicPath === concrete.publicPath)
    ).toMatchObject({ canonicalPath: renamedPath });
    expect(
      removed.find((route) => route.publicPath === concrete.publicPath)
    ).not.toHaveProperty("canonicalPath");
  });

  it("moves one topic mapping to its deterministic active group", async () => {
    const curriculumRoute = Effect.runSync(listPublicCurriculumRoutes()).find(
      (route) => route.locale === sourceRoute.locale
    );
    if (!curriculumRoute) {
      expect.fail("Expected one English curriculum route.");
    }
    const movedParentPath = PublicPathSchema.make(
      "subjects/mathematics/function-modeling"
    );
    const moved = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)({
      ...previewProjection,
      parentPath: movedParentPath,
      publicPath: `${movedParentPath}/function-concept`,
    });
    const movedNext = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)({
      ...previewNextProjection,
      parentPath: movedParentPath,
      publicPath: `${movedParentPath}/injective-surjective-bijective-function`,
    });
    const model = {
      claims: [
        {
          contentKey: moved.contentKey,
          kind: "found",
          locale: moved.locale,
          projection: moved,
        },
      ],
      materials: [moved, movedNext],
    } satisfies MaterialSourceModel;
    const reconciled = Effect.runSync(
      reconcileMaterialSourceRoutes(
        sourceRoute.locale,
        [topicRoute, sourceRoute, nextRoute],
        model
      )
    );
    const curriculumRoutes = await Effect.runPromise(
      reconcileMaterialCurriculumRoutes(
        [
          {
            ...curriculumRoute,
            canonicalPath: sourceRoute.parentPath,
            materialKey: sourceRoute.materialKey,
          },
        ],
        [topicRoute, sourceRoute, nextRoute],
        reconciled,
        model
      )
    );

    expect(curriculumRoutes).toMatchObject([
      { canonicalPath: movedParentPath },
    ]);
    expect(reconciled).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "subject-topic",
          publicPath: movedParentPath,
          title: moved.topicTitle,
        }),
        expect.objectContaining({ publicPath: moved.publicPath }),
        expect.objectContaining({ publicPath: movedNext.publicPath }),
      ])
    );
    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialCurriculumRoutes(
            [
              {
                ...curriculumRoute,
                canonicalPath: sourceRoute.parentPath,
                materialKey: sourceRoute.materialKey,
              },
            ],
            [topicRoute, sourceRoute, nextRoute],
            [makePreviewPublicRoute(moved), nextRoute],
            {
              claims: [
                ...model.claims,
                {
                  contentKey: previewNextProjection.contentKey,
                  kind: "found",
                  locale: previewNextProjection.locale,
                  projection: previewNextProjection,
                },
              ],
              materials: [moved, previewNextProjection],
            }
          )
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("preserves unrelated curriculum mappings and rejects missing replacements", async () => {
    const curriculumRoute = Effect.runSync(listPublicCurriculumRoutes()).find(
      (route) => route.locale === sourceRoute.locale
    );
    if (!curriculumRoute) {
      expect.fail("Expected one English curriculum route.");
    }
    const model = {
      claims: [
        {
          contentKey: previewProjection.contentKey,
          kind: "found",
          locale: previewProjection.locale,
          projection: previewProjection,
        },
      ],
      materials: [],
    } satisfies MaterialSourceModel;
    const unrelatedRoute = {
      ...curriculumRoute,
      canonicalPath: sourceRoute.parentPath,
    };

    await expect(
      Effect.runPromise(
        reconcileMaterialCurriculumRoutes(
          [curriculumRoute, unrelatedRoute],
          [],
          [],
          model
        )
      )
    ).resolves.toEqual([curriculumRoute, unrelatedRoute]);
    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialCurriculumRoutes(
            [{ ...curriculumRoute, canonicalPath: sourceRoute.publicPath }],
            [sourceRoute],
            [],
            model
          )
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: previewProjection.locale,
    });
  });

  it("preserves a typed failure when a published projection cannot become a route", async () => {
    const malformed = structuredClone(previewProjection);
    Reflect.set(malformed, "publicPath", "");

    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialSourceRoutes("en", [sourceRoute], {
            claims: [
              {
                contentKey: previewProjection.contentKey,
                kind: "found",
                locale: "en",
                projection: malformed,
              },
            ],
            materials: [],
          })
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath: "",
    });
  });

  it("rejects incompatible exact topic anchors", async () => {
    const parentPath = PublicPathSchema.make(
      "subjects/mathematics/function-modeling"
    );
    const moved = Schema.decodeUnknownSync(MaterialLessonProjectionSchema)({
      ...previewProjection,
      parentPath,
      publicPath: `${parentPath}/function-concept`,
    });
    const occupied = makePreviewPublicRoute(previewNextProjection, {
      publicPath: parentPath,
    });
    const invalidKey = structuredClone(moved);
    Reflect.set(invalidKey, "contentKey", "material");
    const invalidTitle = structuredClone(moved);
    Reflect.set(invalidTitle, "topicTitle", 1);
    const conflicting = Schema.decodeUnknownSync(
      MaterialLessonProjectionSchema
    )({
      ...previewNextProjection,
      contentKey: ContentKeySchema.make(
        "material/lesson/mathematics/function-modeling/absolute-value-function"
      ),
      graph: makeMaterialGraph(
        "mathematics",
        "function-modeling",
        "absolute-value-function",
        "en"
      ),
      materialKey: "lesson.mathematics.function-modeling",
      metadata: {
        authors: [{ name: "Nabil Akbarazzima Fatih" }],
        date: "2025-05-18",
        description:
          "Learn absolute value functions with interactive graphs, transformations, and worked solutions. Learn properties, equations, and real applications.",
        subject: "Functions and Their Modeling",
        title: "Absolute Value Function",
      },
      parentPath,
      publicPath: `${parentPath}/absolute-value-function`,
      sectionKey: "absolute-value-function",
      topicTitle: "Functions and Their Modeling",
    });

    const failures = [
      { projection: moved, routes: [occupied] },
      { projection: invalidKey, routes: [] },
      { projection: invalidTitle, routes: [] },
    ];
    for (const { projection, routes } of failures) {
      await expect(
        Effect.runPromise(
          Effect.flip(
            reconcileMaterialSourceRoutes("en", routes, {
              claims: [
                {
                  contentKey: projection.contentKey,
                  kind: "found",
                  locale: "en",
                  projection,
                },
              ],
              materials: [],
            })
          )
        )
      ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
    }
    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialSourceRoutes("en", [], {
            claims: [
              {
                contentKey: moved.contentKey,
                kind: "found",
                locale: "en",
                projection: moved,
              },
              {
                contentKey: conflicting.contentKey,
                kind: "found",
                locale: "en",
                projection: conflicting,
              },
            ],
            materials: [],
          })
        )
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("rejects a published route owned by another source identity", async () => {
    await expect(
      Effect.runPromise(
        Effect.flip(
          reconcileMaterialSourceRoutes("en", [nextRoute], {
            claims: [
              {
                contentKey: previewProjection.contentKey,
                kind: "found",
                locale: "en",
                projection: {
                  ...previewProjection,
                  publicPath: PublicPathSchema.make(nextRoute.publicPath),
                },
              },
            ],
            materials: [],
          })
        )
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath: nextRoute.publicPath,
    });
  });
});
