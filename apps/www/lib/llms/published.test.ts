// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { Data, Effect } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readPublishedContent } from "@/lib/content/published/exchange";
import { rendererManifest } from "@/lib/content/renderer/manifest";
import {
  getCachedPublishedText,
  type PublishedMarkdownInput,
} from "@/lib/llms/published";
import {
  testArticleArtifact,
  testArticleProjection,
  testArticleSourcePath,
} from "@/test/content-article";
import { testPageArtifact, testPageProjection } from "@/test/content-page";
import {
  previewMetadata,
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const readContentMock = vi.hoisted(() => vi.fn());
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));

/** Test-only typed failure for the cached Promise boundary. */
class TestPublishedTextError extends Data.TaggedError(
  "TestPublishedTextError"
)<{
  readonly cause: unknown;
}> {}

const rawMdx = `## What is a Function?

A function maps one input to exactly one output.

<FunctionMachine />`;

const preparePublishedFixtures = Effect.fn(
  "llms.test.preparePublishedFixtures"
)(function* () {
  const liveRenderer = yield* rendererManifest;
  const materialData = {
    activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
    artifact: {
      ...previewWireArtifact,
      payload: {
        ...previewWireArtifact.payload,
        rawMdx,
      },
    },
    metadata: previewMetadata,
    projection: previewProjection,
    rendererManifest: liveRenderer,
    sourcePath: previewSourcePath,
    sourceRevision,
  };
  const articleData = {
    activeReleaseId: ReleaseIdSchema.make("release-article"),
    artifact: testArticleArtifact,
    projection: testArticleProjection,
    rendererManifest: liveRenderer,
    sourcePath: testArticleSourcePath,
    sourceRevision,
  };
  const pageData = {
    activeReleaseId: ReleaseIdSchema.make("release-pages"),
    artifact: testPageArtifact,
    projection: testPageProjection,
    rendererManifest: liveRenderer,
    sourcePath: testPageProjection.sourcePath,
    sourceRevision,
  };

  yield* Effect.sync(() => {
    readContentMock.mockImplementation((input: PublishedMarkdownInput) =>
      Effect.succeed(
        { article: articleData, material: materialData, page: pageData }[
          input.family
        ]
      )
    );
  });

  return { articleData, materialData, pageData } as const;
});

vi.mock("next/cache", () => ({
  cacheLife: cacheLifeMock,
  cacheTag: cacheTagMock,
}));
vi.mock("@/lib/content/published/exchange", () => ({
  readPublishedContent: readContentMock,
}));
beforeEach(() => {
  cacheLifeMock.mockReset();
  cacheTagMock.mockReset();
  readContentMock.mockReset();
});

describe("published llms markdown", () => {
  it.effect(
    "projects verified source with immutable provenance and exact cache tags",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: materialData.activeReleaseId,
            appLocale: previewProjection.appLocale,
            family: "material",
            publicPath: previewProjection.publicPath,
          })
        );

        expect(text).toContain(previewMetadata.description);
        expect(text).toContain("What is a Function?");
        expect(text).toContain("Component: FunctionMachine");
        expect(text).toContain(
          `https://raw.githubusercontent.com/nakafaai/aksara/${sourceRevision}/${previewSourcePath}`
        );
        expect(readPublishedContent).toHaveBeenCalledWith({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "material",
          publicPath: previewProjection.publicPath,
        });
        expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
        expect(cacheTagMock).toHaveBeenCalledExactlyOnceWith(
          "content-scope:material"
        );
      })
  );

  it.effect(
    "selects article metadata and provenance through the same cache seam",
    () =>
      Effect.gen(function* () {
        const { articleData } = yield* preparePublishedFixtures();
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: articleData.activeReleaseId,
            appLocale: testArticleProjection.appLocale,
            family: "article",
            publicPath: testArticleProjection.publicPath,
          })
        );

        expect(text).toContain(testArticleProjection.metadata.description);
        expect(text).toContain(testArticleArtifact.payload.rawMdx);
        expect(readPublishedContent).toHaveBeenCalledWith({
          activeReleaseId: articleData.activeReleaseId,
          appLocale: testArticleProjection.appLocale,
          family: "article",
          publicPath: testArticleProjection.publicPath,
        });
        expect(cacheTagMock).toHaveBeenCalledExactlyOnceWith(
          "content-scope:article"
        );
      })
  );

  it.effect(
    "selects signed Page metadata and provenance without filesystem fallback",
    () =>
      Effect.gen(function* () {
        const { pageData } = yield* preparePublishedFixtures();
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: pageData.activeReleaseId,
            appLocale: testPageProjection.appLocale,
            family: "page",
            publicPath: testPageProjection.publicPath,
          })
        );

        expect(text).toContain(testPageProjection.metadata.description);
        expect(text).toContain(testPageArtifact.payload.rawMdx);
        expect(readPublishedContent).toHaveBeenCalledWith({
          activeReleaseId: pageData.activeReleaseId,
          appLocale: testPageProjection.appLocale,
          family: "page",
          publicPath: testPageProjection.publicPath,
        });
        expect(cacheTagMock).toHaveBeenCalledExactlyOnceWith(
          "content-scope:page"
        );
      })
  );

  it.effect(
    "omits source links for rollback state without an exact Git revision",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        readContentMock.mockReturnValueOnce(
          Effect.succeed({ ...materialData, sourceRevision: null })
        );
        const text = yield* Effect.tryPromise(() =>
          getCachedPublishedText({
            activeReleaseId: materialData.activeReleaseId,
            appLocale: previewProjection.appLocale,
            family: "material",
            publicPath: previewProjection.publicPath,
          })
        );

        expect(text).not.toContain("Source:");
      })
  );

  it.effect(
    "fails closed when semantic projection cannot parse signed source",
    () =>
      Effect.gen(function* () {
        const { materialData } = yield* preparePublishedFixtures();
        const incompleteMdx = `${rawMdx}\n{`;
        readContentMock.mockReturnValueOnce(
          Effect.succeed({
            ...materialData,
            artifact: {
              ...materialData.artifact,
              payload: {
                ...materialData.artifact.payload,
                rawMdx: incompleteMdx,
              },
            },
          })
        );
        const failure = yield* Effect.tryPromise({
          catch: (cause) => new TestPublishedTextError({ cause }),
          try: () =>
            getCachedPublishedText({
              activeReleaseId: materialData.activeReleaseId,
              appLocale: previewProjection.appLocale,
              family: "material",
              publicPath: previewProjection.publicPath,
            }),
        }).pipe(Effect.flip);

        expect(failure.cause).toBeInstanceOf(Error);
        if (failure.cause instanceof Error) {
          expect(failure.cause.message).toContain(
            "Unexpected end of file in expression"
          );
        }
      })
  );
});

it.effect("rejects a signed projection from a different family", () =>
  Effect.gen(function* () {
    const { materialData } = yield* preparePublishedFixtures();
    readContentMock.mockReturnValueOnce(Effect.succeed(materialData));
    const failure = yield* Effect.tryPromise({
      catch: (cause) => new TestPublishedTextError({ cause }),
      try: () =>
        getCachedPublishedText({
          activeReleaseId: materialData.activeReleaseId,
          appLocale: previewProjection.appLocale,
          family: "article",
          publicPath: previewProjection.publicPath,
        }),
    }).pipe(Effect.flip);
    expect(failure.cause).toBeInstanceOf(PublishedProjectionError);
  })
);
