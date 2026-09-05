// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ContentKeySchema,
  PublicPathSchema,
  ReleaseIdSchema,
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
import { createElement } from "react";
import {
  getPublishedTrustLesson,
  readPublishedTrustLesson,
} from "@/lib/content/material/trust";
import { ContentExecutionError } from "@/lib/content/published/errors";
import { previewArtifactHash } from "@/test/content-preview";
import { makeMaterialRuntimeSource } from "@/test/content/material";
import { createTestSnapshotContext } from "@/test/content/snapshot";
import {
  createTestRuntimeQuery,
  createTestSnapshotQuery,
} from "@/test/runtime-query";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const runtimeReadMock = vi.hoisted(() => vi.fn());
const cacheMock = vi.hoisted(() => vi.fn());
const renderMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-material");
const publicPath =
  "subjects/mathematics/trigonometry/current-right-triangle-naming";
const sourceBody = "## Signed transport fixture\n\nThe complete source body.";
const published = {
  activeReleaseId,
  artifactHash: previewArtifactHash,
  body: createElement("div", { "data-signed-transport-fixture": "" }),
  rawMdx: `export const metadata = { title: "Signed transport fixture" };\n\n${sourceBody}\n`,
};

vi.mock("@/lib/content/cache", () => ({
  applyPublishedContentCache: cacheMock,
}));
vi.mock("@/lib/content/published/material", () => ({
  readRenderedMaterial: renderMock,
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
            "material/lesson/mathematics/trigonometry/right-triangle-naming"
          ),
          graph: testMaterialGraph(
            "trigonometry",
            "right-triangle-naming",
            "en",
            "mathematics"
          ),
          materialKey: MaterialKeySchema.make(
            "lesson.mathematics.trigonometry"
          ),
          parentPath: PublicPathSchema.make(
            "subjects/mathematics/trigonometry"
          ),
          publicPath: PublicPathSchema.make(
            "subjects/mathematics/trigonometry/current-right-triangle-naming"
          ),
          sectionKey: MaterialSectionSchema.make("right-triangle-naming"),
        });
        const fixture = yield* makeMaterialRuntimeSource([projection]);
        const context = yield* createTestSnapshotContext(fixture.source);
        runtimeReadMock.mockImplementation(createTestSnapshotQuery(context));
        renderMock.mockReturnValueOnce(
          Effect.succeed({ ...published, activeReleaseId: fixture.state.activeReleaseId })
        );

        expect(yield* readPublishedTrustLesson("en")).toEqual({
          artifactHash: published.artifactHash,
          body: published.body,
          sourceBody,
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
    renderMock.mockReset();
    runtimeQueryMock.mockResolvedValue({
      activeReleaseId,
      managed: true,
      publicPath,
    });
    renderMock.mockReturnValue(Effect.succeed(published));
  });

  it.effect(
    "renders one complete artifact beside its body without metadata at the current signed route",
    () =>
      Effect.gen(function* () {
        expect(
          yield* Effect.promise(() => getPublishedTrustLesson("en"))
        ).toEqual({
          artifactHash: published.artifactHash,
          body: published.body,
          lessonHref: `/en/${publicPath}`,
          sourceBody,
          sourceHref: `/en/${publicPath}.md`,
        });
        expect(runtimeQueryMock).toHaveBeenCalledWith(
          api.contentRelease.material.identity,
          {
            contentKey:
              "material/lesson/mathematics/trigonometry/right-triangle-naming",
            appLocale: "en",
            expectedMaterialKey: "lesson.mathematics.trigonometry",
            expectedSectionKey: "right-triangle-naming",
          }
        );
        expect(renderMock).toHaveBeenCalledExactlyOnceWith({
          appLocale: "en",
          publicPath,
        });
        expect(cacheMock).toHaveBeenCalledWith(
          "material",
          published.artifactHash
        );
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
        expect(renderMock).not.toHaveBeenCalled();
      })
  );

  it.effect("requires a valid active release before reading the artifact", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId: null,
        managed: true,
        publicPath,
      });

      const failure = yield* readPublishedTrustLesson("en").pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "PublishedProjectionError",
        appLocale: "en",
        publicPath: "marketing/trust",
      });
      expect(renderMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "rejects a publication change between identity and body reads",
    () =>
      Effect.gen(function* () {
        const actualReleaseId = ReleaseIdSchema.make("release-next");
        renderMock.mockReturnValueOnce(
          Effect.succeed({ ...published, activeReleaseId: actualReleaseId })
        );

        const failure = yield* readPublishedTrustLesson("en").pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId,
          expectedReleaseId: activeReleaseId,
        });
        expect(cacheMock).not.toHaveBeenCalled();
      })
  );

  it.effect("preserves a signed artifact rendering failure", () =>
    Effect.gen(function* () {
      const failure = new ContentExecutionError({
        contentKey: ContentKeySchema.make(
          "material/lesson/mathematics/trigonometry/right-triangle-naming"
        ),
        stage: "evaluate",
      });
      renderMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* readPublishedTrustLesson("en").pipe(Effect.flip)).toBe(
        failure
      );
      expect(cacheMock).not.toHaveBeenCalled();
    })
  );
});
