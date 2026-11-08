// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentRuntimeVerificationError } from "@repo/backend/client/content/errors";
import contentRelease from "@repo/backend/confect/_generated/refs/contentRelease";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Effect, Schema } from "effect";
import {
  PublishedMissingError,
  PublishedProjectionError,
} from "@/lib/content/published/errors";
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

const verifyPublicContentFoundMock = vi.hoisted(() => vi.fn());
const partsMocks = vi.hoisted(() => ({ artifact: vi.fn(), frame: vi.fn() }));
const headQueryMock = vi.hoisted(() => vi.fn());
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
/** The head that the route head query answers for the preview body. */
const routeHead = {
  ...head,
  activeReleaseId: found.activeReleaseId,
  family: "material",
  projectionJson,
};

vi.mock("@repo/backend/client/content/public", () => ({
  verifyPublicContentFound: verifyPublicContentFoundMock,
}));
vi.mock("@/lib/content/published/parts", () => ({
  readPublicArtifact: partsMocks.artifact,
  readReleaseFrame: partsMocks.frame,
}));
vi.mock("@/lib/content/store/query", () => ({
  queryContentStore: headQueryMock,
}));
vi.mock("@/lib/content/renderer/manifest", () => ({
  rendererManifest: Effect.succeed(liveRenderer),
}));

beforeEach(() => {
  headQueryMock.mockReset().mockReturnValue(Effect.succeed(routeHead));
  verifyPublicContentFoundMock
    .mockReset()
    .mockReturnValue(Effect.succeed(found));
  partsMocks.frame.mockReset().mockReturnValue(Effect.succeed(frame));
  partsMocks.artifact.mockReset().mockReturnValue(Effect.succeed(artifactJson));
});

describe("published content exchange", () => {
  it.effect(
    "composes a body from its release frame, its artifact by hash and its head, and verifies it against the live renderer",
    () =>
      Effect.gen(function* () {
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
        expect(headQueryMock).not.toHaveBeenCalled();
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

  it.effect(
    "reads the current body from its route head under the release that head names",
    () =>
      Effect.gen(function* () {
        expect(yield* readCurrentPublishedContent(routeInput)).toEqual({
          activeReleaseId: found.activeReleaseId,
          artifact: found.artifact,
          projection: previewProjection,
          rendererManifest: liveRenderer,
          sourcePath: previewSourcePath,
          sourceRevision,
        });
        expect(headQueryMock).toHaveBeenCalledExactlyOnceWith(
          contentRelease.runtime.active.head,
          routeInput
        );
        expect(partsMocks.frame).toHaveBeenCalledExactlyOnceWith(
          found.activeReleaseId
        );
        expect(partsMocks.artifact).toHaveBeenCalledExactlyOnceWith({
          appLocale,
          artifactHash: previewArtifactHash,
          family: "material",
          publicPath: input.publicPath,
        });
      })
  );

  it.effect(
    "fails as missing for a route with no public body, and as its projection for a head with no valid release",
    () =>
      Effect.gen(function* () {
        headQueryMock
          .mockReturnValueOnce(Effect.succeed(null))
          .mockReturnValueOnce(
            Effect.succeed({ ...routeHead, activeReleaseId: "not a release" })
          );

        expect(
          yield* readCurrentPublishedContent(routeInput).pipe(Effect.flip)
        ).toEqual(new PublishedMissingError(routeInput));
        expect(
          yield* readCurrentPublishedContent(routeInput).pipe(Effect.flip)
        ).toEqual(new PublishedProjectionError(routeInput));
        expect(verifyPublicContentFoundMock).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "omits immutable Git provenance for a forward rollback release",
    () =>
      Effect.gen(function* () {
        verifyPublicContentFoundMock.mockReturnValue(
          Effect.succeed({
            ...found,
            release: {
              manifest: {
                origin: {
                  kind: "rollback",
                  releaseId: found.activeReleaseId,
                } satisfies FoundOrigin,
              },
            },
          })
        );

        expect(yield* readPublishedContent(input)).toMatchObject({
          sourceRevision: null,
        });
      })
  );

  it.effect(
    "fails before rendering when activation changes after ownership",
    () =>
      Effect.gen(function* () {
        const next = ReleaseIdSchema.make("release-next");
        headQueryMock.mockReturnValue(
          Effect.succeed({ ...routeHead, activeReleaseId: next })
        );
        verifyPublicContentFoundMock.mockReturnValue(
          Effect.succeed({ ...found, activeReleaseId: next })
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
