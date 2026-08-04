// @vitest-environment node

import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentRuntimeMissingError } from "@repo/backend/client/content/errors";
import { readContent } from "@repo/backend/client/content/read";
import { verifyContentRenderer } from "@repo/backend/content/verify";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishedContentInput } from "@/lib/content/published/exchange";
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
const locale: PublishedContentInput["locale"] = "en";

interface FoundFixture {
  readonly activeReleaseId: ReturnType<typeof ReleaseIdSchema.make>;
  readonly artifact: typeof previewWireArtifact;
  readonly delivery: "public";
  readonly kind: "found";
  readonly projection: typeof previewProjection;
  readonly release: {
    readonly manifest: {
      readonly origin:
        | { readonly kind: "git"; readonly sha: typeof sourceRevision }
        | {
            readonly kind: "rollback";
            readonly releaseId: ReturnType<typeof ReleaseIdSchema.make>;
          };
    };
  };
  readonly rendererManifest: typeof liveRenderer;
  readonly sourcePath: typeof previewSourcePath;
}

const found: FoundFixture = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: previewWireArtifact,
  delivery: "public",
  kind: "found",
  projection: previewProjection,
  release: {
    manifest: { origin: { kind: "git", sha: sourceRevision } },
  },
  rendererManifest: liveRenderer,
  sourcePath: previewSourcePath,
};
const input = {
  activeReleaseId: found.activeReleaseId,
  locale,
  publicPath: previewProjection.publicPath,
};

vi.mock("@repo/backend/client/content/read", () => ({
  readContent: readContentMock,
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
    expect(readContent).toHaveBeenCalledWith(
      {
        siteUrl: "https://example.convex.site",
        token: "runtime-token",
      },
      {
        delivery: "public",
        locale: input.locale,
        publicPath: input.publicPath,
      }
    );
    expect(verifyContentRenderer).toHaveBeenCalledWith({
      found,
      rendererManifest: liveRenderer,
    });
  });

  it("omits immutable Git provenance for a forward rollback release", async () => {
    const rollback: FoundFixture = {
      ...found,
      release: {
        manifest: {
          origin: {
            kind: "rollback",
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
      Effect.fail(
        new ContentRuntimeMissingError({
          request: {
            delivery: "public",
            locale: input.locale,
            publicPath: input.publicPath,
          },
        })
      )
    );

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "ContentRuntimeMissingError",
      request: {
        locale: input.locale,
        publicPath: input.publicPath,
      },
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
    expect(readContent).not.toHaveBeenCalled();
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

  it("fails closed when a public read returns protected delivery", async () => {
    readContentMock.mockReturnValue(
      Effect.succeed({ ...found, delivery: "authenticated" })
    );

    await expect(
      Effect.runPromise(readPublishedContent(input).pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "ContentRuntimeVerificationError",
      cause: "Public content request returned protected delivery.",
    });
    expect(verifyRendererMock).not.toHaveBeenCalled();
  });
});
