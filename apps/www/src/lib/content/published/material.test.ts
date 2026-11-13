// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { hashContentProjection } from "@nakafa/aksara-contracts/projection/hash";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedEmptyRelease,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { Effect, Option } from "effect";
import { ContentExecutionError } from "@/lib/content/published/errors";
import {
  readPublishedMaterial,
  readRenderedMaterial,
} from "@/lib/content/published/material";
import {
  previewProjection as projection,
  previewSourcePath as sourcePath,
} from "@/test/manifest";
import { makePublishedParts } from "@/test/parts";
import { testArticleProjection } from "@/test/published/article";

/** The verifier, which answers each test's found response. */
const readMock = vi.hoisted(() => vi.fn());
const headMock = vi.hoisted(() => vi.fn());
const partsMocks = vi.hoisted(() => ({ artifact: vi.fn(), frame: vi.fn() }));
const bodyMock = vi.hoisted(() => vi.fn());
const releaseId = ReleaseIdSchema.make("release-material-domain");
/** Builds the signed material found response that each delivery test reads. */
const makeFound = Effect.fn("test.www.publishedMaterial.found")(function* () {
  const release = yield* testSignedEmptyRelease(releaseId);
  const found: PublicContentRuntimeFound = {
    activeManifestHash: release.manifestHash,
    activeReleaseId: release.manifest.releaseId,
    artifact: yield* testSignedArtifact("mathematics", {
      contentKey: projection.contentKey,
      rawMdx: "## Material delivery evidence\n\nThe signed material source.",
    }),
    delivery: "public",
    kind: "found",
    projection,
    projectionHash: yield* hashContentProjection(projection),
    release,
    rendererManifest: TEST_PROOF_RENDERER,
    sourcePath,
  };
  return found;
});
const input = {
  appLocale: projection.appLocale,
  publicPath: projection.publicPath,
};

vi.mock("@repo/backend/client/content/public", () => ({
  verifyPublicContentFound: readMock,
}));
vi.mock("@/lib/content/store/query", () => ({
  queryContentStore: headMock,
}));
vi.mock("@/lib/content/published/parts", () => ({
  readPublicArtifact: partsMocks.artifact,
  readReleaseFrame: partsMocks.frame,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(TEST_PROOF_RENDERER),
}));
vi.mock("@/lib/content/published/body", () => ({
  readRenderedBody: bodyMock,
}));

/** The Convex answers that the found response of each test is composed from. */
const parts = () =>
  makeFound().pipe(
    Effect.map((found) => makePublishedParts(found, "material"))
  );

beforeEach(() => {
  readMock.mockReset().mockImplementation(() => makeFound());
  headMock
    .mockReset()
    .mockImplementation(() => parts().pipe(Effect.map(({ head }) => head)));
  partsMocks.frame
    .mockReset()
    .mockImplementation(() => parts().pipe(Effect.map(({ frame }) => frame)));
  partsMocks.artifact
    .mockReset()
    .mockImplementation(() =>
      parts().pipe(Effect.map(({ artifactJson }) => artifactJson))
    );
  bodyMock.mockReset().mockReturnValue(Effect.succeed("cached-material-body"));
});

describe("published material delivery", () => {
  it.effect("keeps current source evidence with its signed rendered body", () =>
    Effect.gen(function* () {
      const found = yield* makeFound();
      expect(yield* readRenderedMaterial(input)).toEqual({
        activeReleaseId: found.activeReleaseId,
        artifactHash: found.artifact.artifactHash,
        body: "cached-material-body",
        metadata: projection.metadata,
        projection,
        rawMdx: found.artifact.payload.rawMdx,
        rendererDomain: found.artifact.payload.rendererDomain,
        sourcePath,
        sourceRevision: GitCommitShaSchema.make("a".repeat(40)),
      });
      expect(headMock).toHaveBeenCalledExactlyOnceWith(
        contentRelease.runtime.active.head,
        input
      );
      expect(partsMocks.frame).toHaveBeenCalledExactlyOnceWith(
        found.activeReleaseId
      );
      expect(bodyMock).toHaveBeenCalledExactlyOnceWith(
        found.artifact,
        Option.some("material")
      );
    })
  );

  it.effect("reads the current rollback without inventing Git provenance", () =>
    Effect.gen(function* () {
      const found = yield* makeFound();
      const base = found.release;
      const rollbackEmpty = yield* testEmptyManifest(
        ReleaseIdSchema.make("release-material-rollback")
      );
      const rollback = yield* testSignedRelease({
        ...rollbackEmpty,
        baseActiveAppLocales: base.manifest.activeAppLocales,
        baseManifestHash: base.manifestHash,
        baseReleaseId: base.manifest.releaseId,
        origin: { kind: "rollback", releaseId: base.manifest.releaseId },
      });
      readMock.mockReturnValueOnce(
        Effect.succeed({
          ...found,
          activeManifestHash: rollback.manifestHash,
          activeReleaseId: rollback.manifest.releaseId,
          release: rollback,
        })
      );

      expect(yield* readPublishedMaterial(input)).toEqual({
        activeReleaseId: rollback.manifest.releaseId,
        artifact: found.artifact,
        metadata: projection.metadata,
        projection,
        rendererManifest: TEST_PROOF_RENDERER,
        sourcePath,
        sourceRevision: null,
      });
      expect(bodyMock).not.toHaveBeenCalled();
    })
  );

  it.effect.each([{ ...projection, unexpected: true }, testArticleProjection])(
    "rejects excess fields and a different content family",
    (invalid) =>
      Effect.gen(function* () {
        const found = yield* makeFound();
        readMock.mockReturnValueOnce(
          Effect.succeed({ ...found, projection: invalid })
        );

        expect(
          yield* readRenderedMaterial(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        });
        expect(bodyMock).not.toHaveBeenCalled();
      })
  );

  it.effect.each([
    { ...input, appLocale: AppLocaleSchema.make("de") },
    { ...input, publicPath: "subjects/mathematics/another-lesson" },
  ])(
    "rejects a projection selected for a different public identity",
    (request) =>
      Effect.gen(function* () {
        expect(
          yield* readRenderedMaterial(request).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedProjectionError",
          appLocale: request.appLocale,
          publicPath: request.publicPath,
        });
        expect(bodyMock).not.toHaveBeenCalled();
      })
  );

  it.effect("preserves signed-read failure before rendering", () =>
    Effect.gen(function* () {
      const failure = new ContentRuntimeVerificationError({
        cause: "Invalid material signature",
      });
      readMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* readRenderedMaterial(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(bodyMock).not.toHaveBeenCalled();
    })
  );

  it.effect("preserves a typed failure from the immutable body cache", () =>
    Effect.gen(function* () {
      const found = yield* makeFound();
      const failure = new ContentExecutionError({
        contentKey: found.artifact.payload.contentKey,
        stage: "render",
      });
      bodyMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* readRenderedMaterial(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(readMock).toHaveBeenCalledOnce();
    })
  );
});
