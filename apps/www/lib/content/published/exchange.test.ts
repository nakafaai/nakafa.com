// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { PublicContentMissingError } from "@repo/backend/client/content/errors";
import { readPublicContent } from "@repo/backend/client/content/read";
import { verifyContentRenderer } from "@repo/backend/content/verify";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedContent } from "@/lib/content/published/exchange";
import {
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const readContentMock = vi.hoisted(() => vi.fn());
const runtimeKeysMock = vi.hoisted(() => vi.fn());
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
  activeReleaseId: found.activeReleaseId,
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
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: runtimeKeysMock,
}));
vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
  },
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(liveRenderer),
}));

beforeEach(() => {
  readContentMock.mockReset();
  runtimeKeysMock.mockReset();
  runtimeKeysMock.mockReturnValue({
    CONTENT_RUNTIME_TOKEN: "runtime-token",
  });
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
      { locale: input.locale, publicPath: input.publicPath }
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
    ).resolves.toMatchObject({
      _tag: "PublicContentMissingError",
      locale: input.locale,
      publicPath: input.publicPath,
    });

    readContentMock.mockReturnValueOnce(Effect.succeed(found));
    verifyRendererMock.mockReturnValueOnce(
      Effect.fail({ _tag: "ContentEnvelopeMismatchError" })
    );

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentEnvelopeMismatchError" });
  });

  it("fails closed when the selected runtime has no private credential", async () => {
    runtimeKeysMock.mockImplementation(() => {
      throw new Error("missing runtime token");
    });

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toEqual({
      _tag: "ContentRuntimeConfigurationError",
      key: "CONTENT_RUNTIME_TOKEN",
    });
    expect(contentRuntimeKeys).toHaveBeenCalledOnce();
    expect(readPublicContent).not.toHaveBeenCalled();
  });

  it("fails before rendering when activation changes after ownership", async () => {
    readContentMock.mockReturnValue(
      Effect.succeed({
        ...found,
        activeReleaseId: ReleaseIdSchema.make("release-next"),
      })
    );

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: found.activeReleaseId,
    });
    expect(verifyRendererMock).not.toHaveBeenCalled();
  });
});
