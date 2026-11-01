// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { CurriculumRouteSchema } from "@nakafa/aksara-contracts/program/curriculum";
import { createTestPublication } from "@repo/backend/test/content/publication";
import { Effect, Layer, Schema } from "effect";
import { readPublishedMaterialPlacements } from "@/lib/content/material/context";
import { activateTestRelease } from "@/test/active";
import { makeProgramContextRuntimeSource } from "@/test/content/program-context";
import { previewProjection } from "@/test/content-preview";
import {
  testCurriculumRowJson,
  testProgramClass,
  testProgramContexts,
  testProgramGroups,
  testProgramRoot,
  testProgramSubject,
} from "@/test/content-program";
import { resetTestRuntimeCache } from "@/test/store";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
vi.mock(
  "@/lib/content/store/memory",
  async () => (await import("@/test/store")).testRuntimeCacheModule
);
vi.mock(
  "@/lib/content/published/active",
  async () => (await import("@/test/active")).testActiveModule
);
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
const place = {
  ancestorJson: [
    testCurriculumRowJson(testProgramRoot),
    testCurriculumRowJson(testProgramClass),
  ],
  groupJson: testCurriculumRowJson(group),
  mappingJson: testCurriculumRowJson(mapping),
  parentJson: testCurriculumRowJson(testProgramSubject),
  resolvedCanonicalPath: mapping.canonicalPath ?? "",
};
vi.mock("@confect/js", async (importOriginal) => {
  const { HttpClient } = await importOriginal<typeof import("@confect/js")>();
  return {
    HttpClient: {
      ...HttpClient,
      layer: (...args: Parameters<typeof HttpClient.layer>) =>
        Layer.effect(
          HttpClient.HttpClient,
          Effect.gen(function* () {
            const client = yield* HttpClient.HttpClient;
            return {
              ...client,
              query: runtimeQueryMock,
            };
          })
        ).pipe(Layer.provide(HttpClient.layer(...args))),
    },
  };
});
beforeEach(() => {
  runtimeQueryMock.mockReset();
  resetTestRuntimeCache();
  activateTestRelease(ReleaseIdSchema.make("release-material"));
});
describe("published material places", () => {
  it.effect(
    "reads the verified places of a lesson from its signed curriculum",
    () =>
      Effect.gen(function* () {
        const fixture = yield* makeProgramContextRuntimeSource();
        const snapshot = yield* createTestPublication(fixture.source);
        runtimeQueryMock.mockImplementation(snapshot.query);

        expect(
          yield* readPublishedMaterialPlacements("en", previewProjection)
        ).toMatchObject([
          { context, label: "Function Composition and Inverses" },
        ]);
      })
  );

  it.effect(
    "asks for a material's places by its identity, and keeps what a lesson's links read",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockReturnValueOnce(Effect.succeed([place]));

        expect(
          yield* readPublishedMaterialPlacements("en", previewProjection)
        ).toStrictEqual([
          {
            context,
            hash: expect.any(String),
            label: "Function Composition and Inverses",
            parent: { publicPath: testProgramSubject.publicPath },
            resolvedCanonicalPath: place.resolvedCanonicalPath,
            trail: [
              {
                label: testProgramRoot.title,
                publicPath: testProgramRoot.publicPath,
              },
              {
                label: testProgramClass.title,
                publicPath: testProgramClass.publicPath,
              },
              {
                label: testProgramSubject.title,
                publicPath: testProgramSubject.publicPath,
              },
            ],
          },
        ]);
        expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
          appLocale: "en",
          contentKey: previewProjection.contentKey,
          materialKey: previewProjection.materialKey,
          parentPath: previewProjection.parentPath,
          publicPath: previewProjection.publicPath,
        });
      })
  );

  it.effect("asks Convex once for a material's places in one release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValue(Effect.succeed([place]));

      for (const _ of [1, 2, 3]) {
        yield* readPublishedMaterialPlacements("en", previewProjection);
      }
      expect(runtimeQueryMock).toHaveBeenCalledOnce();

      activateTestRelease(ReleaseIdSchema.make("release-material-next"));
      yield* readPublishedMaterialPlacements("en", previewProjection);
      expect(runtimeQueryMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("pins the read when its caller reads several in one release", () =>
    Effect.gen(function* () {
      const activeReleaseId = ReleaseIdSchema.make("release-material");
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed([]));

      yield* readPublishedMaterialPlacements(
        "en",
        previewProjection,
        activeReleaseId
      );

      expect(runtimeQueryMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ expectedActiveReleaseId: activeReleaseId })
      );
    })
  );

  it.effect("answers no place for a material that no curriculum shows", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(Effect.succeed([]));

      expect(
        yield* readPublishedMaterialPlacements("en", previewProjection)
      ).toStrictEqual([]);
    })
  );

  it.effect("preserves an invalid place as a typed failure", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockReturnValueOnce(
        Effect.succeed([{ ...place, resolvedCanonicalPath: "elsewhere" }])
      );

      expect(
        yield* readPublishedMaterialPlacements("en", previewProjection).pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );
});
