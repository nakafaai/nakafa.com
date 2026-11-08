// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ContentProjectionSchema } from "@nakafa/aksara-contracts/projection/spec";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import {
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import { verifyPublicContentFound } from "@repo/backend/client/content/public";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import { Effect, Schema } from "effect";

const input = {
  appLocale: AppLocaleSchema.make("en"),
  publicPath: PublicPathSchema.make("test/head-0"),
};
const ArtifactJsonSchema = Schema.fromJsonString(SignedContentArtifactSchema);
const ProjectionJsonSchema = Schema.fromJsonString(ContentProjectionSchema);
const ReleaseJsonSchema = Schema.fromJsonString(SignedContentReleaseSchema);
const RendererJsonSchema = Schema.fromJsonString(
  RendererManifestEnvelopeSchema
);
const verifyMock = vi.hoisted(() => vi.fn());

vi.mock("@nakafa/aksara-contracts/runtime/verify", () => ({
  verifyContentRuntimeExchange: verifyMock,
}));

/** Creates one structurally complete public found response. */
function foundResponse() {
  return {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    artifact: Schema.decodeSync(ArtifactJsonSchema)(testArtifactJson()),
    delivery: "public",
    kind: "found",
    projection: Schema.decodeSync(ProjectionJsonSchema)(testProjectionJson()),
    projectionHash: TEST_DIGEST,
    release: Schema.decodeSync(ReleaseJsonSchema)(testReleaseJson()),
    rendererManifest: Schema.decodeSync(RendererJsonSchema)(testRendererJson()),
    sourcePath: "packages/corpus/test/head-0/en.mdx",
  };
}

beforeEach(() => {
  verifyMock.mockReset();
  verifyMock.mockImplementation(({ response }) => Effect.succeed(response));
});

describe("public content verification", () => {
  it.effect(
    "verifies a composed public response with the live renderer and returns it",
    () =>
      Effect.gen(function* () {
        const response = foundResponse();
        const renderer = yield* Schema.decodeEffect(RendererJsonSchema)(
          testRendererJson()
        );
        expect(
          yield* verifyPublicContentFound(input, response, renderer)
        ).toEqual(response);
        expect(verifyContentRuntimeExchange).toHaveBeenCalledWith({
          request: { ...input, delivery: "public" },
          response,
          rendererManifest: renderer,
        });
      })
  );

  it.effect(
    "rejects a composed value that is not a found response before verification",
    () =>
      Effect.gen(function* () {
        for (const value of [{}, { kind: "missing" }]) {
          expect(
            yield* verifyPublicContentFound(input, value, {}).pipe(Effect.flip)
          ).toEqual(new ContentTransportError({ reason: "response-contract" }));
        }
        expect(verifyMock).not.toHaveBeenCalled();
      })
  );

  it.effect("keeps a signature failure as the verification error", () =>
    Effect.gen(function* () {
      const cause = new Error("signature mismatch");
      verifyMock.mockReturnValueOnce(Effect.fail(cause));
      expect(
        yield* verifyPublicContentFound(input, foundResponse(), {}).pipe(
          Effect.flip
        )
      ).toEqual(new ContentRuntimeVerificationError({ cause }));
    })
  );

  it.effect("rejects an invalid public route before verification", () =>
    Effect.gen(function* () {
      expect(
        yield* verifyPublicContentFound(
          { ...input, publicPath: "" },
          foundResponse(),
          {}
        ).pipe(Effect.flip)
      ).toEqual(new ContentTransportError({ reason: "request" }));
      expect(verifyMock).not.toHaveBeenCalled();
    })
  );
});
