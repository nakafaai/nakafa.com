// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { PublicContentMissingError } from "@repo/backend/client/content/errors";
import { readPublicContent } from "@repo/backend/client/content/read";
import { verifyContentRenderer } from "@repo/backend/content/verify";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedContent } from "@/lib/content/published/exchange";
import {
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const readContentMock = vi.hoisted(() => vi.fn());
const verifyRendererMock = vi.hoisted(() => vi.fn());
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
vi.mock("@repo/backend/client/content/read", () => ({
  readPublicContent: readContentMock,
}));
vi.mock("@repo/backend/content/verify", () => ({
  verifyContentRenderer: verifyRendererMock,
}));
vi.mock("@/env", () => ({
  env: {
    CONTENT_RUNTIME_TOKEN: "runtime-token",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  },
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(liveRenderer),
}));

beforeEach(() => {
  readContentMock.mockReset();
  verifyRendererMock.mockReset();
  verifyRendererMock.mockImplementation(
    ({ found: verified }: { readonly found: unknown }) =>
      Effect.succeed(verified)
  );
});

describe("published content exchange", () => {
  it("binds trusted active state to the exact public projection", async () => {
    readContentMock.mockReturnValue(Effect.succeed(found));

    await expect(
      Effect.runPromise(readPublishedContent(input))
    ).resolves.toEqual({
      activeReleaseId: found.activeReleaseId,
      artifact: found.artifact,
      projection: previewProjection,
      rendererManifest: liveRenderer,
      sourcePath: previewSourcePath,
      sourceRevision,
    });
    expect(readPublicContent).toHaveBeenCalledWith(
      {
        siteUrl: "https://example.convex.site",
        token: "runtime-token",
      },
      input
    );
    expect(verifyContentRenderer).toHaveBeenCalledWith({
      found,
      rendererManifest: liveRenderer,
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
    readContentMock.mockReturnValue(Effect.succeed(rollback));

    await expect(
      Effect.runPromise(readPublishedContent(input))
    ).resolves.toMatchObject({ sourceRevision: null });
  });

  it("preserves signed-read and live-renderer failures", async () => {
    readContentMock.mockReturnValueOnce(
      Effect.fail(new PublicContentMissingError(input))
    );

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublicContentMissingError", ...input });

    readContentMock.mockReturnValueOnce(Effect.succeed(found));
    verifyRendererMock.mockReturnValueOnce(
      Effect.fail({ _tag: "ContentEnvelopeMismatchError" })
    );

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentEnvelopeMismatchError" });
  });
});
