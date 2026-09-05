// @vitest-environment node

import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
} from "@repo/backend/client/content/errors";
import {
  readPublicContent,
  readSnapshotPublicContent,
} from "@repo/backend/client/content/public";
import { readActiveIdentity } from "@repo/backend/content/publication/read";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { ContentSnapshotError } from "@repo/backend/content/snapshot/error";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import { contentRuntimeKeys } from "@repo/next-config/keys";
import { Context, Effect, Layer } from "effect";
import type { PublishedContentInput } from "@/lib/content/published/exchange";
import {
  readCurrentPublishedContent,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import {
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/content-preview";

const readPublicContentMock = vi.hoisted(() => vi.fn());
const readSnapshotPublicContentMock = vi.hoisted(() => vi.fn());
const snapshotMock = vi.hoisted(() => vi.fn());
const runtimeKeysMock = vi.hoisted(() => vi.fn());
const runtimeEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_CONVEX_SITE_URL: "https://production.convex.site",
}));
const liveRenderer = vi.hoisted(() => ({
  hash: `sha256:${"e".repeat(64)}`,
  rendererContractVersion: "1.0.0",
}));
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const appLocale: PublishedContentInput["appLocale"] =
  previewProjection.appLocale;

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
  appLocale,
  publicPath: previewProjection.publicPath,
};
const routeInput = {
  appLocale: input.appLocale,
  publicPath: input.publicPath,
};

vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContent: readPublicContentMock,
  readSnapshotPublicContent: readSnapshotPublicContentMock,
}));
vi.mock("@/lib/content/runtime/snapshot", () => ({
  loadContentSnapshot: snapshotMock,
}));
vi.mock("@repo/next-config/keys", () => ({
  contentRuntimeKeys: runtimeKeysMock,
}));
vi.mock("@/env", () => ({
  env: runtimeEnv,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(liveRenderer),
}));

beforeEach(() => {
  readPublicContentMock.mockReset();
  readSnapshotPublicContentMock.mockReset();
  snapshotMock.mockReset().mockResolvedValue(undefined);
  runtimeKeysMock.mockReset();
  runtimeKeysMock.mockReturnValue({
    CONTENT_RUNTIME_TOKEN: "runtime-token",
  });
});

describe("published content exchange", () => {
  it.effect("binds trusted active state to the exact public projection", () =>
    Effect.gen(function* () {
      readPublicContentMock.mockReturnValue(Effect.succeed(found));

      expect(yield* readPublishedContent(input)).toEqual({
        activeReleaseId: found.activeReleaseId,
        artifact: found.artifact,
        projection: previewProjection,
        rendererManifest: liveRenderer,
        sourcePath: previewSourcePath,
        sourceRevision,
      });
      expect(readPublicContent).toHaveBeenCalledWith(
        {
          siteUrl: runtimeEnv.NEXT_PUBLIC_CONVEX_SITE_URL,
          token: "runtime-token",
        },
        {
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        },
        liveRenderer
      );
      expect(readSnapshotPublicContent).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "omits immutable Git provenance for a forward rollback release",
    () =>
      Effect.gen(function* () {
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
        readPublicContentMock.mockReturnValue(Effect.succeed(rollback));

        expect(yield* readPublishedContent(input)).toMatchObject({
          sourceRevision: null,
        });
      })
  );

  it.effect(
    "reads the signed current publication without a prior release lookup",
    () =>
      Effect.gen(function* () {
        const next = {
          ...found,
          activeReleaseId: ReleaseIdSchema.make("release-next"),
        };
        readPublicContentMock.mockReturnValue(Effect.succeed(next));

        expect(yield* readCurrentPublishedContent(routeInput)).toMatchObject({
          activeReleaseId: next.activeReleaseId,
        });
      })
  );

  it.effect(
    "provides the selected publication context without live transport credentials",
    () =>
      Effect.gen(function* () {
        const source = makeRuntimeSource();
        const tables = yield* projectActiveRuntime(source.source);
        const context = yield* Layer.build(snapshotPublicationLayer(tables));
        snapshotMock.mockResolvedValue(context);
        runtimeKeysMock.mockImplementation(() => {
          throw new Error("The live runtime token is absent.");
        });
        readSnapshotPublicContentMock.mockReturnValue(
          readActiveIdentity().pipe(
            Effect.map((identity) => {
              assert.isNotNull(identity);
              return { ...found, activeReleaseId: identity.releaseId };
            })
          )
        );

        expect(yield* readCurrentPublishedContent(routeInput)).toMatchObject({
          activeReleaseId: source.state.activeReleaseId,
          sourceRevision,
        });

        expect(readSnapshotPublicContent).toHaveBeenCalledWith(
          routeInput,
          liveRenderer
        );
        expect(contentRuntimeKeys).not.toHaveBeenCalled();
        expect(readPublicContent).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "rejects snapshot loading failures before either exchange can run",
    () =>
      Effect.gen(function* () {
        const failure = new ContentSnapshotError({
          message:
            "Serving snapshot data failed its descriptor integrity check.",
        });
        snapshotMock.mockRejectedValue(failure);

        expect(
          yield* readPublishedContent(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeVerificationError",
          cause: failure,
        });
        expect(contentRuntimeKeys).not.toHaveBeenCalled();
        expect(readPublicContent).not.toHaveBeenCalled();
        expect(readSnapshotPublicContent).not.toHaveBeenCalled();
      })
  );

  it.effect("preserves snapshot artifact failures without a native retry", () =>
    Effect.gen(function* () {
      snapshotMock.mockResolvedValue(Context.empty());
      const failure = new ContentRuntimeMissingError({
        request: {
          ...routeInput,
          delivery: "public",
        },
      });
      readSnapshotPublicContentMock.mockReturnValue(Effect.fail(failure));

      expect(yield* readPublishedContent(input).pipe(Effect.flip)).toBe(
        failure
      );
      expect(readPublicContent).not.toHaveBeenCalled();
    })
  );

  it.effect("enforces release ownership for snapshot exchanges", () =>
    Effect.gen(function* () {
      snapshotMock.mockResolvedValue(Context.empty());
      readSnapshotPublicContentMock.mockReturnValue(
        Effect.succeed({
          ...found,
          activeReleaseId: ReleaseIdSchema.make("release-next"),
        })
      );

      expect(
        yield* readPublishedContent(input).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "PublishedReleaseMismatchError",
        actualReleaseId: "release-next",
        expectedReleaseId: found.activeReleaseId,
      });
      expect(readPublicContent).not.toHaveBeenCalled();
    })
  );

  it.effect("preserves signed-read and live-renderer failures", () =>
    Effect.gen(function* () {
      readPublicContentMock.mockReturnValueOnce(
        Effect.fail(
          new ContentRuntimeMissingError({
            request: {
              appLocale: input.appLocale,
              delivery: "public",
              publicPath: input.publicPath,
            },
          })
        )
      );

      expect(
        yield* readPublishedContent(input).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ContentRuntimeMissingError",
        request: {
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        },
      });

      readPublicContentMock.mockReturnValueOnce(
        Effect.fail(
          new ContentRuntimeVerificationError({
            cause: new Error("The signed renderer does not match."),
          })
        )
      );

      expect(
        yield* readPublishedContent(input).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeVerificationError" });
    })
  );

  it.effect(
    "fails closed when the live runtime has no private credential",
    () =>
      Effect.gen(function* () {
        runtimeKeysMock.mockImplementation(() => {
          throw new Error("missing runtime token");
        });

        expect(
          yield* readPublishedContent(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentRuntimeConfigurationError",
          key: "CONTENT_RUNTIME_TOKEN",
        });
        expect(contentRuntimeKeys).toHaveBeenCalledOnce();
        expect(readPublicContent).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "fails before rendering when activation changes after ownership",
    () =>
      Effect.gen(function* () {
        readPublicContentMock.mockReturnValue(
          Effect.succeed({
            ...found,
            activeReleaseId: ReleaseIdSchema.make("release-next"),
          })
        );

        expect(
          yield* readPublishedContent(input).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "PublishedReleaseMismatchError",
          actualReleaseId: "release-next",
          expectedReleaseId: found.activeReleaseId,
        });
      })
  );
});
