// @vitest-environment node

import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import {
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
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
  it("builds contextual cards from real curriculum and lesson projections", async () => {
    const group = testProgramGroups[0];
    expect(group).toBeDefined();
    if (!group) {
      return;
    }
    const cards = await Effect.runPromise(
      readPublishedMaterialCards({
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
      })
    );

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
  });

  it("returns no cards for a route that does not own a card list", async () => {
    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: testProgramContexts,
          groups: testProgramGroups,
          locale: "en",
          materials: [previewProjection],
          route: testProgramClass,
        })
      )
    ).resolves.toEqual([]);
  });

  it("rejects a group without source-owned description copy", async () => {
    const group = testProgramGroups[0];
    expect(group).toBeDefined();
    if (!group) {
      return;
    }

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
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
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("rejects a group without a connected published lesson", async () => {
    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [],
          groups: testProgramGroups,
          locale: "en",
          materials: [previewProjection],
          route: testProgramSubject,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("selects one exact lesson when the context owns its public path", async () => {
    const context = testProgramContexts[0];
    const group = testProgramGroups[0];
    expect(context).toBeDefined();
    expect(group).toBeDefined();
    if (!(context && group)) {
      return;
    }
    const exactContext = Schema.decodeSync(CurriculumRouteSchema)({
      ...context,
      canonicalPath: previewProjection.publicPath,
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [exactContext],
          groups: [group],
          locale: "en",
          materials: [previewProjection],
          route: testProgramSubject,
        })
      )
    ).resolves.toMatchObject([
      {
        items: [{ title: previewProjection.metadata.title }],
      },
    ]);
  });

  it("rejects a material context without a canonical path", async () => {
    const context = testProgramContexts[0];
    expect(context).toBeDefined();
    if (!context) {
      return;
    }
    const malformedContext = {
      ...context,
      canonicalPath: undefined,
    };

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [malformedContext],
          groups: testProgramGroups,
          locale: "en",
          materials: [previewProjection],
          route: testProgramSubject,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("omits a context whose material was tombstoned", async () => {
    const context = testProgramContexts[0];
    expect(context).toBeDefined();
    if (!context) {
      return;
    }
    const missingContext = Schema.decodeSync(CurriculumRouteSchema)({
      ...context,
      materialKey: MaterialKeySchema.make("lesson.mathematics.missing-topic"),
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [missingContext],
          groups: testProgramGroups,
          locale: "en",
          materials: [previewProjection],
          route: testProgramSubject,
        })
      )
    ).resolves.toEqual([]);
  });

  it("maps a stable material key to its one renamed parent", async () => {
    const context = testProgramContexts[0];
    const group = testProgramGroups[0];
    expect(context).toBeDefined();
    expect(group).toBeDefined();
    if (!(context && group)) {
      return;
    }
    const renamed = Schema.decodeSync(MaterialLessonProjectionSchema)({
      ...previewProjection,
      parentPath: "subjects/mathematics/renamed-functions",
      publicPath:
        "subjects/mathematics/renamed-functions/function-concept-renamed",
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [context],
          groups: [group],
          locale: "en",
          materials: [renamed],
          route: testProgramSubject,
        })
      )
    ).resolves.toMatchObject([
      {
        items: [
          {
            href: expect.stringContaining(renamed.publicPath),
            title: renamed.metadata.title,
          },
        ],
      },
    ]);
  });

  it("keeps source siblings when one exact lesson moves", async () => {
    const context = testProgramContexts[0];
    const group = testProgramGroups[0];
    expect(context).toBeDefined();
    expect(group).toBeDefined();
    if (!(context && group)) {
      return;
    }
    const moved = Schema.decodeSync(MaterialLessonProjectionSchema)({
      ...previewProjection,
      parentPath: "subjects/mathematics/moved-functions",
      publicPath: "subjects/mathematics/moved-functions/function-concept-moved",
    });

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [context],
          groups: [group],
          locale: "en",
          materials: [moved, previewNextProjection],
          route: testProgramSubject,
        })
      )
    ).resolves.toMatchObject([
      {
        items: [
          { title: moved.metadata.title },
          { title: previewNextProjection.metadata.title },
        ],
      },
    ]);
  });

  it("rejects a renamed material key with ambiguous current parents", async () => {
    const context = testProgramContexts[0];
    const group = testProgramGroups[0];
    expect(context).toBeDefined();
    expect(group).toBeDefined();
    if (!(context && group)) {
      return;
    }
    const materials = ["first", "second"].map((suffix) =>
      Schema.decodeSync(MaterialLessonProjectionSchema)({
        ...previewProjection,
        parentPath: `subjects/mathematics/${suffix}-functions`,
        publicPath: `subjects/mathematics/${suffix}-functions/function-concept`,
      })
    );

    await expect(
      Effect.runPromise(
        readPublishedMaterialCards({
          contexts: [context],
          groups: [group],
          locale: "en",
          materials,
          route: testProgramSubject,
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });
});
