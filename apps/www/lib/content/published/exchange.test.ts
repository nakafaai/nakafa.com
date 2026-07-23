// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedMaterial } from "@/lib/content/published/exchange";
import { fetchPublicContentRuntime } from "@/lib/content/published/request";
import {
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const fetchRuntimeMock = vi.hoisted(() => vi.fn());
const verifyRuntimeMock = vi.hoisted(() => vi.fn());
const liveRenderer = vi.hoisted(() => ({
  hash: `sha256:${"e".repeat(64)}`,
  rendererContractVersion: "1.0.0",
}));
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const found = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: previewWireArtifact,
  kind: "found" as const,
  projection: previewProjection,
  release: {
    manifest: { origin: { kind: "git" as const, sha: sourceRevision } },
  },
  rendererManifest: liveRenderer,
  sourcePath: previewSourcePath,
};
const input = {
  locale: "en" as const,
  publicPath: previewProjection.publicPath,
};

vi.mock("server-only", () => ({}));
vi.mock("@nakafa/aksara-contracts/runtime/verify", () => ({
  verifyContentRuntimeExchange: verifyRuntimeMock,
}));
vi.mock("@/lib/content/published/request", () => ({
  fetchPublicContentRuntime: fetchRuntimeMock,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(liveRenderer),
}));

beforeEach(() => {
  fetchRuntimeMock.mockReset();
  verifyRuntimeMock.mockReset();
  verifyRuntimeMock.mockImplementation(
    ({ response }: { readonly response: unknown }) =>
      ContentVerificationKeyResolver.pipe(Effect.as(response))
  );
});

describe("published material exchange", () => {
  it("binds trusted active state to the exact public route projection", async () => {
    const exchange = {
      request: { delivery: "public", ...input },
      response: found,
      status: 200,
    };
    fetchRuntimeMock.mockReturnValue(Effect.succeed(exchange));

    await expect(
      Effect.runPromise(readPublishedMaterial(input))
    ).resolves.toEqual({
      activeReleaseId: found.activeReleaseId,
      artifact: found.artifact,
      metadata: previewProjection.metadata,
      rendererManifest: liveRenderer,
      route: {
        description: previewProjection.metadata.description,
        kind: "subject-lesson",
        locale: "en",
        materialKey: previewProjection.materialKey,
        order: previewProjection.order,
        parentPath: previewProjection.parentPath,
        publicPath: previewProjection.publicPath,
        sectionKey: previewProjection.sectionKey,
        sitemap: true,
        sourcePath: previewProjection.contentKey,
        title: previewProjection.metadata.title,
      },
      sourcePath: previewSourcePath,
      sourceRevision,
    });
    expect(fetchPublicContentRuntime).toHaveBeenCalledWith({
      delivery: "public",
      ...input,
    });
    expect(verifyRuntimeMock).toHaveBeenCalledWith({
      rendererManifest: liveRenderer,
      request: exchange.request,
      response: found,
    });
  });

  it("omits immutable Git provenance for a forward rollback release", async () => {
    const rollback = {
      ...found,
      release: {
        manifest: {
          origin: {
            kind: "rollback" as const,
            releaseId: found.activeReleaseId,
          },
        },
      },
    };
    fetchRuntimeMock.mockReturnValue(
      Effect.succeed({
        request: { delivery: "public", ...input },
        response: rollback,
        status: 200,
      })
    );

    await expect(
      Effect.runPromise(readPublishedMaterial(input))
    ).resolves.toMatchObject({ sourceRevision: null });
  });

  it("surfaces known-route absence and sanitized target failures", async () => {
    fetchRuntimeMock
      .mockReturnValueOnce(
        Effect.succeed({
          request: { delivery: "public", ...input },
          response: { kind: "missing" },
          status: 404,
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          request: { delivery: "public", ...input },
          response: {
            code: "CONTENT_RUNTIME_INTERNAL",
            kind: "failure",
          },
          status: 500,
        })
      );

    await expect(
      Effect.runPromise(readPublishedMaterial(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedContentMissingError",
      ...input,
    });
    await expect(
      Effect.runPromise(readPublishedMaterial(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedContentFailureError",
      code: "CONTENT_RUNTIME_INTERNAL",
      status: 500,
    });
  });

  it("rejects a verified projection that cannot satisfy the route shell", async () => {
    fetchRuntimeMock.mockReturnValue(
      Effect.succeed({
        request: { delivery: "public", ...input },
        response: {
          ...found,
          projection: { ...previewProjection, parentPath: "" },
        },
        status: 200,
      })
    );

    await expect(
      Effect.runPromise(readPublishedMaterial(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath: previewProjection.publicPath,
    });
  });
});
