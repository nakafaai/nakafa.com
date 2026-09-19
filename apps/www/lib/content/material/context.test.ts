// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Effect, Schema } from "effect";
import { readPublishedMaterialContext } from "@/lib/content/material/context";
import { makeProgramContextRuntimeSource } from "@/test/content/program-context";
import { previewProjection } from "@/test/content-preview";
import {
  testCurriculumRowJson,
  testProgramContexts,
  testProgramGroups,
  testProgramSubject,
} from "@/test/content-program";
import { createTestNativeQuery } from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
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

vi.mock("@repo/backend/client/nakafa/query", () => ({
  readNakafaRuntimeQuery: runtimeQueryMock,
}));

beforeEach(() => {
  runtimeQueryMock.mockReset();
});

describe("published material context", () => {
  it.effect(
    "resolves signed curriculum context and preserves a missing optional hint",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramContextRuntimeSource();
        const snapshot = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(createTestNativeQuery(snapshot));

        expect(
          yield* readPublishedMaterialContext("en", previewProjection, context)
        ).toMatchObject({
          context,
          group,
          label: "Function Composition and Inverses",
          mapping,
          parent: testProgramSubject,
        });
        expect(
          yield* readPublishedMaterialContext("en", previewProjection, {
            ...context,
            nodeKey: `${context.nodeKey}-missing`,
          })
        ).toBeNull();
      })
  );

  it.effect("resolves a material identity without a global release pin", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed(publishedContext));

      expect(
        yield* readPublishedMaterialContext("en", previewProjection, context)
      ).toMatchObject({ context, group, mapping });
      expect(runtimeQueryMock).toHaveBeenCalledWith(
        "https://test.convex.cloud",
        expect.anything(),
        {
          appLocale: "en",
          contentKey: previewProjection.contentKey,
          materialKey: previewProjection.materialKey,
          nodeKey: context.nodeKey,
          parentPath: previewProjection.parentPath,
          programKey: context.programKey,
          publicPath: previewProjection.publicPath,
        }
      );
    })
  );

  it.effect(
    "pins sequential uncached context reads when their caller requires it",
    () =>
      Effect.gen(function* () {
        const activeReleaseId = ReleaseIdSchema.make("release-material");
        runtimeQueryMock.mockReturnValueOnce(Effect.succeed(publishedContext));
        yield* readPublishedMaterialContext(
          "en",
          previewProjection,
          context,
          activeReleaseId
        );
        expect(runtimeQueryMock).toHaveBeenCalledWith(
          "https://test.convex.cloud",
          expect.anything(),
          expect.objectContaining({
            contentKey: previewProjection.contentKey,
            expectedActiveReleaseId: activeReleaseId,
          })
        );
      })
  );

  it.effect(
    "preserves invalid projection failures at the server boundary",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockReturnValueOnce(
          Effect.succeed({ ...publishedContext, managed: false })
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

vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_URL: "https://test.convex.cloud" },
}));
