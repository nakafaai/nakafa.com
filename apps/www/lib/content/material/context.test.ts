// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type CurriculumRoute,
  CurriculumRouteSchema,
} from "@nakafa/aksara-contracts/program/curriculum";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import {
  getPublishedMaterialContext,
  readPublishedMaterialContext,
} from "@/lib/content/material/context";
import { previewProjection } from "@/test/content-preview";
import {
  testCurriculumRowJson,
  testProgramContexts,
  testProgramGroups,
  testProgramSubject,
} from "@/test/content-program";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const [group] = Schema.decodeUnknownSync(Schema.Tuple([CurriculumRouteSchema]))(
  testProgramGroups
);
const context = {
  nodeKey: group.nodeKey,
  programKey: group.programKey,
};
const [mapping] = Schema.decodeUnknownSync(
  Schema.Tuple([CurriculumRouteSchema])
)(testProgramContexts);
const publishedContext = {
  groupJson: testCurriculumRowJson(group),
  managed: true,
  mappingJson: testCurriculumRowJson(mapping),
  parentJson: testCurriculumRowJson(testProgramSubject),
  resolvedCanonicalPath: mapping.canonicalPath ?? null,
};

vi.mock("@/lib/content/cache", () => ({
  applyContentRuntimeCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeQueryMock,
}));

beforeEach(() => {
  runtimeQueryMock.mockReset();
  cacheMock.mockReset();
});

describe("published material context", () => {
  it.effect("builds a return link from verified curriculum rows", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(publishedContext));

      expect(
        yield* Effect.promise(() =>
          getPublishedMaterialContext("en", previewProjection, context)
        )
      ).toMatchObject({
        context,
        group: {
          nodeKey: group.nodeKey,
          publicPath: group.publicPath,
        },
        href: expect.stringContaining(
          "/en/curriculum/merdeka/class-11/mathematics#"
        ),
        label: "Function Composition and Inverses",
        mapping: {
          canonicalPath: mapping.canonicalPath,
        },
        parent: {
          nodeKey: testProgramSubject.nodeKey,
          publicPath: testProgramSubject.publicPath,
        },
      });
      expect(cacheMock).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "rejects unmanaged context and preserves an invalid optional hint",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock
          .mockReturnValueOnce(
            Effect.succeed({
              groupJson: null,
              managed: false,
              mappingJson: null,
              parentJson: null,
              resolvedCanonicalPath: null,
            })
          )
          .mockReturnValueOnce(
            Effect.succeed({
              groupJson: null,
              managed: true,
              mappingJson: null,
              parentJson: null,
              resolvedCanonicalPath: null,
            })
          );

        expect(
          yield* readPublishedMaterialContext(
            "en",
            previewProjection,
            context
          ).pipe(Effect.flip)
        ).toMatchObject({ _tag: "PublishedProjectionError" });
        expect(
          yield* readPublishedMaterialContext("en", previewProjection, context)
        ).toBeNull();
      })
  );

  it.effect("pins a context read to the expected active release", () =>
    Effect.gen(function* () {
      const activeReleaseId = ReleaseIdSchema.make("release-material");
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          groupJson: null,
          managed: true,
          mappingJson: null,
          parentJson: null,
          resolvedCanonicalPath: null,
        })
      );

      expect(
        yield* readPublishedMaterialContext(
          "en",
          previewProjection,
          context,
          activeReleaseId
        )
      ).toBeNull();
      expect(runtimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          contentKey: previewProjection.contentKey,
          expectedActiveReleaseId: activeReleaseId,
        })
      );
    })
  );

  it.effect(
    "accepts course parents and falls back to the authored group title",
    () =>
      Effect.gen(function* () {
        const courseParent = {
          ...testProgramSubject,
          level: "course",
        } satisfies CurriculumRoute;
        const groupWithoutCardTitle = {
          ...group,
          materialCardTitle: undefined,
        };
        runtimeQueryMock
          .mockReturnValueOnce(
            Effect.succeed({
              ...publishedContext,
              parentJson: testCurriculumRowJson(courseParent),
            })
          )
          .mockReturnValueOnce(
            Effect.succeed({
              ...publishedContext,
              groupJson: testCurriculumRowJson(groupWithoutCardTitle),
            })
          );

        expect(
          yield* readPublishedMaterialContext("en", previewProjection, context)
        ).toMatchObject({ parent: { level: "course" } });
        expect(
          yield* readPublishedMaterialContext("en", previewProjection, context)
        ).toMatchObject({ label: group.title });
      })
  );

  it.effect("accepts a backend-verified renamed material parent", () =>
    Effect.gen(function* () {
      const renamedParent = PublicPathSchema.make(
        "subjects/mathematics/renamed-functions"
      );
      const renamedMaterial = {
        ...previewProjection,
        parentPath: renamedParent,
        publicPath: PublicPathSchema.make(
          `${renamedParent}/renamed-function-concept`
        ),
      };
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          ...publishedContext,
          resolvedCanonicalPath: renamedParent,
        })
      );

      expect(
        yield* readPublishedMaterialContext("en", renamedMaterial, context)
      ).toMatchObject({
        mapping: { canonicalPath: mapping.canonicalPath },
      });
    })
  );

  it.effect.each([
    [
      "partial rows",
      {
        groupJson: testCurriculumRowJson(group),
        managed: true,
        mappingJson: testCurriculumRowJson(mapping),
        parentJson: null,
      },
    ],
    [
      "foreign group",
      {
        ...publishedContext,
        groupJson: testCurriculumRowJson({
          ...group,
          nodeKey: `${group.nodeKey}-other`,
        }),
      },
    ],
    [
      "invalid parent level",
      {
        ...publishedContext,
        parentJson: testCurriculumRowJson({
          ...testProgramSubject,
          level: "unit",
        }),
      },
    ],
  ])("rejects %s", ([, result]) =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(result));

      expect(
        yield* readPublishedMaterialContext(
          "en",
          previewProjection,
          context
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect("rejects a mapping for a different material route", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed({
          ...publishedContext,
          mappingJson: testCurriculumRowJson({
            ...mapping,
            canonicalPath: PublicPathSchema.make(
              `${previewProjection.parentPath}/other-lesson`
            ),
          }),
          resolvedCanonicalPath: PublicPathSchema.make(
            `${previewProjection.parentPath}/other-lesson`
          ),
        })
      );

      expect(
        yield* readPublishedMaterialContext(
          "en",
          previewProjection,
          context
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
