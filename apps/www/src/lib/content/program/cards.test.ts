// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import {
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect, Schema } from "effect";
import { readPublishedMaterialCards } from "@/lib/content/program/cards";
import {
  previewNextProjection,
  previewProjection,
} from "@/test/content-preview";
import {
  testProgramClass,
  testProgramContexts,
  testProgramGroups,
  testProgramRoot,
  testProgramSubject,
} from "@/test/content-program";

describe("published program material cards", () => {
  it.effect(
    "builds contextual cards from real curriculum and lesson projections",
    () =>
      Effect.gen(function* () {
        const group = testProgramGroups[0];
        expect(group).toBeDefined();
        if (!group) {
          return;
        }
        const cards = yield* readPublishedMaterialCards({
          contexts: [
            testProgramRoot,
            {
              ...testProgramClass,
              materialContextPublicPath: group.publicPath,
            },
            ...testProgramContexts,
          ],
          groups: testProgramGroups,
          locale: "en",
          materials: [previewProjection],
          route: testProgramSubject,
        });

        expect(cards).toEqual([
          {
            description: "Operate on functions and domains.",
            href: expect.stringContaining(
              "/en/subjects/mathematics/function-composition-inverse-function/function-concept?ctx=merdeka~"
            ),
            items: [
              {
                href: expect.stringContaining("?ctx=merdeka~"),
                title: "Function Concept",
              },
            ],
            title: "Function Composition and Inverses",
          },
        ]);
      })
  );

  it.effect("returns no cards for a route that does not own a card list", () =>
    Effect.gen(function* () {
      const cards = yield* readPublishedMaterialCards({
        contexts: testProgramContexts,
        groups: testProgramGroups,
        locale: "en",
        materials: [previewProjection],
        route: testProgramClass,
      });
      expect(cards).toEqual([]);
    })
  );

  it.effect("rejects a group without source-owned description copy", () =>
    Effect.gen(function* () {
      const group = testProgramGroups[0];
      expect(group).toBeDefined();
      if (!group) {
        return;
      }

      const failure = yield* readPublishedMaterialCards({
        contexts: testProgramContexts,
        groups: [
          {
            ...group,
            materialCardDescription: undefined,
            materialCardTitle: undefined,
          },
        ],
        locale: "en",
        materials: [previewProjection],
        route: testProgramSubject,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("rejects a group without a connected published lesson", () =>
    Effect.gen(function* () {
      const failure = yield* readPublishedMaterialCards({
        contexts: [],
        groups: testProgramGroups,
        locale: "en",
        materials: [previewProjection],
        route: testProgramSubject,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "selects one exact lesson when the context owns its public path",
    () =>
      Effect.gen(function* () {
        const context = testProgramContexts[0];
        const group = testProgramGroups[0];
        expect(context).toBeDefined();
        expect(group).toBeDefined();
        if (!(context && group)) {
          return;
        }
        const exactContext = yield* Schema.decodeEffect(CurriculumRouteSchema)({
          ...context,
          canonicalPath: previewProjection.publicPath,
        });

        const cards = yield* readPublishedMaterialCards({
          contexts: [exactContext],
          groups: [group],
          locale: "en",
          materials: [previewProjection],
          route: testProgramSubject,
        });
        expect(cards).toMatchObject([
          {
            items: [{ title: previewProjection.metadata.title }],
          },
        ]);
      })
  );

  it.effect("rejects a material context without a canonical path", () =>
    Effect.gen(function* () {
      const context = testProgramContexts[0];
      expect(context).toBeDefined();
      if (!context) {
        return;
      }
      const malformedContext = {
        ...context,
        canonicalPath: undefined,
      };

      const failure = yield* readPublishedMaterialCards({
        contexts: [malformedContext],
        groups: testProgramGroups,
        locale: "en",
        materials: [previewProjection],
        route: testProgramSubject,
      }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("omits a context whose material was tombstoned", () =>
    Effect.gen(function* () {
      const context = testProgramContexts[0];
      expect(context).toBeDefined();
      if (!context) {
        return;
      }
      const missingContext = yield* Schema.decodeEffect(CurriculumRouteSchema)({
        ...context,
        materialKey: MaterialKeySchema.make("lesson.mathematics.missing-topic"),
      });

      const cards = yield* readPublishedMaterialCards({
        contexts: [missingContext],
        groups: testProgramGroups,
        locale: "en",
        materials: [previewProjection],
        route: testProgramSubject,
      });
      expect(cards).toEqual([]);
    })
  );

  it.effect("maps a stable material key to its one renamed parent", () =>
    Effect.gen(function* () {
      const context = testProgramContexts[0];
      const group = testProgramGroups[0];
      expect(context).toBeDefined();
      expect(group).toBeDefined();
      if (!(context && group)) {
        return;
      }
      const renamed = yield* Schema.decodeEffect(
        MaterialLessonProjectionSchema
      )({
        ...previewProjection,
        parentPath: "subjects/mathematics/renamed-functions",
        publicPath:
          "subjects/mathematics/renamed-functions/function-concept-renamed",
      });

      const cards = yield* readPublishedMaterialCards({
        contexts: [context],
        groups: [group],
        locale: "en",
        materials: [renamed],
        route: testProgramSubject,
      });
      expect(cards).toMatchObject([
        {
          items: [
            {
              href: expect.stringContaining(renamed.publicPath),
              title: renamed.metadata.title,
            },
          ],
        },
      ]);
    })
  );

  it.effect("keeps source siblings when one exact lesson moves", () =>
    Effect.gen(function* () {
      const context = testProgramContexts[0];
      const group = testProgramGroups[0];
      expect(context).toBeDefined();
      expect(group).toBeDefined();
      if (!(context && group)) {
        return;
      }
      const moved = yield* Schema.decodeEffect(MaterialLessonProjectionSchema)({
        ...previewProjection,
        parentPath: "subjects/mathematics/moved-functions",
        publicPath:
          "subjects/mathematics/moved-functions/function-concept-moved",
      });

      const cards = yield* readPublishedMaterialCards({
        contexts: [context],
        groups: [group],
        locale: "en",
        materials: [moved, previewNextProjection],
        route: testProgramSubject,
      });
      expect(cards).toMatchObject([
        {
          items: [
            { title: moved.metadata.title },
            { title: previewNextProjection.metadata.title },
          ],
        },
      ]);
    })
  );

  it.effect(
    "rejects a renamed material key with ambiguous current parents",
    () =>
      Effect.gen(function* () {
        const context = testProgramContexts[0];
        const group = testProgramGroups[0];
        expect(context).toBeDefined();
        expect(group).toBeDefined();
        if (!(context && group)) {
          return;
        }
        const materials = yield* Effect.forEach(["first", "second"], (suffix) =>
          Schema.decodeEffect(MaterialLessonProjectionSchema)({
            ...previewProjection,
            parentPath: `subjects/mathematics/${suffix}-functions`,
            publicPath: `subjects/mathematics/${suffix}-functions/function-concept`,
          })
        );

        const failure = yield* readPublishedMaterialCards({
          contexts: [context],
          groups: [group],
          locale: "en",
          materials,
          route: testProgramSubject,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "PublishedProjectionError" });
      })
  );
});
