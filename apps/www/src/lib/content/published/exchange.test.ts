// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import {
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
} from "@repo/backend/client/content/errors";
import { readPublicContent } from "@repo/backend/client/content/public";
import { contentRuntimeKeys } from "@repo/site/keys";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import type { PublishedContentInput } from "@/lib/content/published/exchange";
import {
  decodePublishedDelivery,
  readCurrentPublishedContent,
  readPublishedContent,
} from "@/lib/content/published/exchange";
import {
  previewArtifactHash,
  previewProjection,
  previewSourcePath,
  previewWireArtifact,
} from "@/test/manifest";

const readPublicContentMock = vi.hoisted(() => vi.fn());
const verifyPublicContentFoundMock = vi.hoisted(() => vi.fn());
const partsMocks = vi.hoisted(() => ({ artifact: vi.fn(), frame: vi.fn() }));
const runtimeKeysMock = vi.hoisted(() => vi.fn());
/** The content store on a miss: it runs the load it was given. */
const storeReadMock = vi.hoisted(() =>
  vi.fn(({ load }: { readonly load: unknown }) => load)
);
const runtimeEnv = vi.hoisted(() => ({
  VITE_CONVEX_SITE_URL: "https://production.convex.site",
}));
const liveRenderer = vi.hoisted(() => ({
  hash: `sha256:${"e".repeat(64)}`,
}));
const sourceRevision = GitCommitShaSchema.make("a".repeat(40));
const appLocale: PublishedContentInput["appLocale"] =
  previewProjection.appLocale;

/** Release origin of a found delivery, as the runtime Schema describes it. */
type FoundOrigin = PublicContentRuntimeFound["release"]["manifest"]["origin"];

const found = {
  activeReleaseId: ReleaseIdSchema.make("release-function-concept"),
  artifact: previewWireArtifact,
  delivery: "public" satisfies PublicContentRuntimeFound["delivery"],
  kind: "found" satisfies PublicContentRuntimeFound["kind"],
  projection: previewProjection,
  release: {
    manifest: {
      origin: { kind: "git", sha: sourceRevision } satisfies FoundOrigin,
    },
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
/** The head that a lesson's query names for the preview body. */
const head = {
  artifactHash: previewArtifactHash,
  projectionHash: `sha256:${"b".repeat(64)}`,
  sourcePath: previewSourcePath,
};
/** The signed release frame that the preview body is verified against. */
const frame = {
  activeManifestHash: `sha256:${"c".repeat(64)}`,
  activeReleaseId: found.activeReleaseId,
  releaseJson: encodeJsonText(found.release),
  rendererJson: encodeJsonText(liveRenderer),
};
const deliveryInput = { ...input, family: "material" } as const;
const artifactJson = encodeJsonText(previewWireArtifact);
const projectionJson = encodeJsonText(previewProjection);
const decodeJson = Schema.decodeSync(JsonTextSchema);

vi.mock("@repo/backend/client/content/public", () => ({
  readPublicContent: readPublicContentMock,
  verifyPublicContentFound: verifyPublicContentFoundMock,
}));
vi.mock("@/lib/content/published/parts", () => ({
  readPublicArtifact: partsMocks.artifact,
  readReleaseFrame: partsMocks.frame,
}));
vi.mock("@repo/site/keys", () => ({
  contentRuntimeKeys: runtimeKeysMock,
}));
vi.mock("@/lib/content/store/read", () => ({
  readContentStore: storeReadMock,
}));
vi.mock("@/env", () => ({
  env: runtimeEnv,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(liveRenderer),
}));

beforeEach(() => {
  readPublicContentMock.mockReset();
  verifyPublicContentFoundMock.mockReset();
  partsMocks.frame.mockReset().mockReturnValue(Effect.succeed(frame));
  partsMocks.artifact.mockReset().mockReturnValue(Effect.succeed(artifactJson));
  runtimeKeysMock.mockReset();
  runtimeKeysMock.mockReturnValue({
    CONTENT_READ_TOKEN: "runtime-token",
  });
});

describe("published content exchange", () => {
  it.effect(
    "composes a body from its release frame, its artifact by hash and its head, and verifies it against the live renderer",
    () =>
      Effect.gen(function* () {
        verifyPublicContentFoundMock.mockReturnValue(Effect.succeed(found));

        expect(
          yield* decodePublishedDelivery(deliveryInput, head, projectionJson)
        ).toEqual({
          activeReleaseId: found.activeReleaseId,
          artifact: found.artifact,
          projection: previewProjection,
          rendererManifest: liveRenderer,
          sourcePath: previewSourcePath,
          sourceRevision,
        });
        expect(partsMocks.frame).toHaveBeenCalledExactlyOnceWith(
          found.activeReleaseId
        );
        expect(partsMocks.artifact).toHaveBeenCalledExactlyOnceWith({
          appLocale,
          artifactHash: previewArtifactHash,
          family: "material",
          publicPath: input.publicPath,
        });
        expect(verifyPublicContentFoundMock).toHaveBeenCalledExactlyOnceWith(
          routeInput,
          {
            activeManifestHash: frame.activeManifestHash,
            activeReleaseId: frame.activeReleaseId,
            artifact: decodeJson(artifactJson),
            delivery: "public",
            kind: "found",
            projection: decodeJson(projectionJson),
            projectionHash: head.projectionHash,
            release: decodeJson(frame.releaseJson),
            rendererManifest: liveRenderer,
            sourcePath: previewSourcePath,
          },
          liveRenderer
        );
        expect(readPublicContentMock).not.toHaveBeenCalled();
        expect(runtimeKeysMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "fails as the route's projection when a part is missing or is not JSON",
    () =>
      Effect.gen(function* () {
        partsMocks.frame.mockReturnValueOnce(Effect.succeed(null));
        partsMocks.artifact
          .mockReturnValueOnce(Effect.succeed(artifactJson))
          .mockReturnValueOnce(Effect.succeed(null))
          .mockReturnValueOnce(Effect.succeed("{"));

        for (const _ of ["frame", "artifact", "artifact text"]) {
          expect(
            yield* decodePublishedDelivery(
              deliveryInput,
              head,
              projectionJson
            ).pipe(Effect.flip)
          ).toEqual(new PublishedProjectionError(routeInput));
        }
        expect(verifyPublicContentFoundMock).not.toHaveBeenCalled();
      })
  );

  it.effect("refuses an artifact that is not the one its head names", () =>
    Effect.gen(function* () {
      verifyPublicContentFoundMock.mockReturnValue(
        Effect.succeed({
          ...found,
          artifact: {
            ...found.artifact,
            artifactHash: `sha256:${"d".repeat(64)}`,
          },
        })
      );

      expect(
        yield* decodePublishedDelivery(
          deliveryInput,
          head,
          projectionJson
        ).pipe(Effect.flip)
      ).toEqual(new PublishedProjectionError(routeInput));
    })
  );

  it.effect("preserves signed verification failures", () =>
    Effect.gen(function* () {
      verifyPublicContentFoundMock.mockReturnValue(
        Effect.fail(
          new ContentRuntimeVerificationError({ cause: "Invalid signature" })
        )
      );
      expect(
        yield* decodePublishedDelivery(
          deliveryInput,
          head,
          projectionJson
        ).pipe(Effect.flip)
      ).toMatchObject({ _tag: "ContentRuntimeVerificationError" });
    })
  );

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
          siteUrl: runtimeEnv.VITE_CONVEX_SITE_URL,
          token: "runtime-token",
        },
        {
          appLocale: input.appLocale,
          publicPath: input.publicPath,
        },
        liveRenderer
      );
    })
  );

  it.effect(
    "omits immutable Git provenance for a forward rollback release",
    () =>
      Effect.gen(function* () {
        const rollback = {
          ...found,
          release: {
            manifest: {
              origin: {
                kind: "rollback",
                releaseId: found.activeReleaseId,
              } satisfies FoundOrigin,
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
          key: "CONTENT_READ_TOKEN",
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
