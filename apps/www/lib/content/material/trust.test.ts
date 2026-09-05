// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ContentKeySchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import { api } from "@repo/backend/convex/_generated/api";
import {
  makeMaterialProjection,
  testMaterialGraph,
} from "@repo/backend/test/content/material";
import { Effect } from "effect";
import {
  getPublishedTrustLesson,
  readPublishedTrustLesson,
} from "@/lib/content/material/trust";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/cache", () => ({
  applyPublishedCatalogCache: cacheMock,
}));
vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeReadMock,
}));

describe("published marketing trust lesson", () => {
  it.effect(
    "follows the stable trust identity to its current signed public route",
    () =>
      Effect.gen(function* () {
        const projection = MaterialLessonProjectionSchema.make({
          ...makeMaterialProjection("en", 1),
          contentKey: ContentKeySchema.make(
            "material/lesson/mathematics/exponential-logarithm/basic-concept"
          ),
          graph: testMaterialGraph(
            "exponential-logarithm",
            "basic-concept",
            "en",
            "mathematics"
          ),
          materialKey: MaterialKeySchema.make(
            "lesson.mathematics.exponential-logarithm"
          ),
          parentPath: PublicPathSchema.make(
            "subjects/mathematics/exponential-logarithm"
          ),
          publicPath: PublicPathSchema.make(
            "subjects/mathematics/exponential-logarithm/current-basic-concept"
          ),
          sectionKey: MaterialSectionSchema.make("basic-concept"),
        });
        const fixture = yield* makeMaterialRuntimeSource([projection]);
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeReadMock.mockImplementation(createTestSnapshotQuery(context));

        expect(yield* readPublishedTrustLesson("en")).toEqual({
          lessonHref: `/en/${projection.publicPath}`,
          sourceHref: `/en/${projection.publicPath}.md`,
        });
      })
  );

  beforeEach(() => {
    runtimeQueryMock.mockReset();
    runtimeReadMock.mockImplementation(
      createTestRuntimeQuery(runtimeQueryMock)
    );
    cacheMock.mockReset();
  });

  it.effect(
    "resolves the current signed route from its stable lesson identity",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce({
          activeReleaseId: "release-material",
          managed: true,
          publicPath:
            "subjects/mathematics/exponential-logarithm/current-basic-concept",
        });

        expect(
          yield* Effect.promise(() => getPublishedTrustLesson("en"))
        ).toEqual({
          lessonHref:
            "/en/subjects/mathematics/exponential-logarithm/current-basic-concept",
          sourceHref:
            "/en/subjects/mathematics/exponential-logarithm/current-basic-concept.md",
        });
        expect(runtimeQueryMock).toHaveBeenCalledWith(
          api.contentRelease.material.identity,
          {
            contentKey:
              "material/lesson/mathematics/exponential-logarithm/basic-concept",
            appLocale: "en",
            expectedMaterialKey: "lesson.mathematics.exponential-logarithm",
            expectedSectionKey: "basic-concept",
          }
        );
        expect(cacheMock).toHaveBeenCalledWith("material");
      })
  );

  it.effect.each([
    ["unmanaged", false, null],
    ["missing", true, null],
    ["malformed", true, "/copied/path"],
  ] as const)(
    "rejects a %s signed identity without a copied route",
    ([_name, managed, publicPath]) =>
      Effect.gen(function* () {
        runtimeQueryMock.mockResolvedValueOnce({
          activeReleaseId: managed ? "release-material" : null,
          managed,
          publicPath,
        });

        const failure = yield* readPublishedTrustLesson("en").pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: "en",
          publicPath: "marketing/trust",
        });
      })
  );
});
