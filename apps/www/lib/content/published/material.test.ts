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
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { Effect } from "effect";
import { ContentExecutionError } from "@/lib/content/published/errors";
import {
  readPublishedMaterial,
  readRenderedMaterial,
} from "@/lib/content/published/material";
import { testArticleProjection } from "@/test/content-article";
import {
  previewProjection as projection,
  previewSourcePath as sourcePath,
} from "@/test/content-preview";

const readMock = vi.hoisted(() => vi.fn());
const bodyMock = vi.hoisted(() => vi.fn());
const release = testSignedRelease(
  testEmptyManifest(ReleaseIdSchema.make("release-material-domain"))
);
const found: PublicContentRuntimeFound = {
  activeManifestHash: release.manifestHash,
  activeReleaseId: release.manifest.releaseId,
  artifact: testSignedArtifact("mathematics", {
    contentKey: projection.contentKey,
    rawMdx: "## Material delivery evidence\n\nThe signed material source.",
  }),
  delivery: "public",
  kind: "found",
  projection,
  projectionHash: hashContentProjection(projection),
  release,
  rendererManifest: TEST_PROOF_RENDERER,
  sourcePath,
};
const input = {
  appLocale: projection.appLocale,
  publicPath: projection.publicPath,
};

vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContent: readMock,
}));
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: () => ({ CONTENT_RUNTIME_TOKEN: "test-runtime-token" }),
}));
vi.mock("@/env", () => ({
  env: { NEXT_PUBLIC_CONVEX_SITE_URL: "https://test.convex.site" },
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(TEST_PROOF_RENDERER),
}));
vi.mock("@/lib/content/published/body", () => ({
  readRenderedBody: bodyMock,
}));

beforeEach(() => {
  readMock.mockReset().mockReturnValue(Effect.succeed(found));
  bodyMock.mockReset().mockReturnValue(Effect.succeed("cached-material-body"));
});

describe("published material delivery", () => {
  it.effect("keeps current source evidence with its signed rendered body", () =>
    Effect.gen(function* () {
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
      expect(readMock).toHaveBeenCalledExactlyOnceWith(
        {
          siteUrl: "https://test.convex.site",
          token: "test-runtime-token",
        },
        input,
        TEST_PROOF_RENDERER
      );
      expect(bodyMock).toHaveBeenCalledExactlyOnceWith(found.artifact);
    })
  );

  it.effect("reads the current rollback without inventing Git provenance", () =>
    Effect.gen(function* () {
      const rollback = testSignedRelease({
        ...testEmptyManifest(ReleaseIdSchema.make("release-material-rollback")),
        baseActiveAppLocales: release.manifest.activeAppLocales,
        baseManifestHash: release.manifestHash,
        baseReleaseId: release.manifest.releaseId,
        origin: { kind: "rollback", releaseId: release.manifest.releaseId },
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
      const failure = new ContentExecutionError({
        contentKey: found.artifact.payload.contentKey,
        stage: "evaluate",
      });
      bodyMock.mockReturnValueOnce(Effect.fail(failure));

      expect(yield* readRenderedMaterial(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(readMock).toHaveBeenCalledOnce();
    })
  );
});
