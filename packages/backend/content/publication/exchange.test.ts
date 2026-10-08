import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { PublicContentRuntimeResponseSchema } from "@nakafa/aksara-contracts/runtime/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  decodePublicRuntimeRow,
  encodePublicDelivery,
  PublicRuntimeReadError,
} from "@repo/backend/content/publication/exchange";
import {
  createTestPublication,
  makePageRuntimeSource,
} from "@repo/backend/test/content/publication";
import { TEST_QUESTION_PROJECTION_JSON } from "@repo/backend/test/content/question";
import { Effect, Schema } from "effect";

const decodeArtifact = Schema.decodeUnknownSync(
  Schema.fromJsonString(SignedContentArtifactSchema)
);
const decodeRuntime = Schema.decodeUnknownSync(
  Schema.fromJsonString(PublicContentRuntimeResponseSchema)
);

const readFixture = Effect.fn("test.publicationExchange")(function* () {
  const fixture = makePageRuntimeSource();
  const runtime = yield* createTestPublication(fixture.source);
  const row = yield* runtime.query(
    refs.internal.contentRelease.runtime.publication.internal.read,
    {
      appLocale: fixture.projection.appLocale,
      publicPath: fixture.projection.publicPath,
    }
  );
  assert(row, "Expected one signed public page.");
  return row;
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe("stored public exchange", () => {
  it.effect(
    "binds one body to its exact shell and preserves a withdrawal",
    () =>
      Effect.gen(function* () {
        const row = yield* readFixture();
        const response = yield* decodePublicRuntimeRow(row);
        assert(response);
        const runtime = {
          projectionJson: row.projectionJson,
          response,
        };
        const source = yield* encodePublicDelivery(runtime, row);
        expect(decodeRuntime(source ?? "")).toMatchObject({
          activeReleaseId: row.activeReleaseId,
          projectionHash: row.projectionHash,
        });
        expect(
          yield* encodePublicDelivery(null, {
            activeReleaseId: row.activeReleaseId,
            projectionJson: null,
          })
        ).toBeNull();
        for (const model of [
          {
            activeReleaseId: "different-release",
            projectionJson: row.projectionJson,
          },
          {
            activeReleaseId: row.activeReleaseId,
            projectionJson: "different-projection",
          },
          {
            activeReleaseId: row.activeReleaseId,
            projectionJson: null,
          },
        ]) {
          expect(
            yield* encodePublicDelivery(runtime, model).pipe(Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        }
        expect(
          yield* encodePublicDelivery(null, row).pipe(Effect.flip)
        ).toMatchObject({
          code: "CONTENT_RELEASE_INTEGRITY",
        });
      })
  );
  it.effect(
    "decodes exact signed body and provenance, preserving absence",
    () =>
      Effect.gen(function* () {
        const row = yield* readFixture();
        const response = yield* decodePublicRuntimeRow(row);
        expect(response).toMatchObject({
          activeManifestHash: row.activeManifestHash,
          activeReleaseId: row.activeReleaseId,
          delivery: "public",
          projectionHash: row.projectionHash,
          sourcePath: row.sourcePath,
        });
        expect(response?.artifact).toEqual(decodeArtifact(row.artifactJson));
        expect(yield* decodePublicRuntimeRow(null)).toBeNull();
      })
  );
  it.effect(
    "rejects malformed evidence and conflicting advertised identities",
    () =>
      Effect.gen(function* () {
        const row = yield* readFixture();
        const differentHash = `sha256:${"f".repeat(64)}`;
        for (const patch of [
          {
            artifactJson: "{",
          },
          {
            projectionJson: "{",
          },
          {
            releaseJson: "{",
          },
          {
            rendererJson: "{",
          },
          {
            sourcePath: "outside-corpus.mdx",
          },
          {
            projectionHash: "not-a-digest",
          },
          {
            projectionHash: differentHash,
          },
          {
            activeManifestHash: differentHash,
          },
          {
            activeReleaseId: "different-release",
          },
          {
            projectionJson: TEST_QUESTION_PROJECTION_JSON,
          },
        ]) {
          expect(
            yield* decodePublicRuntimeRow({
              ...row,
              ...patch,
            }).pipe(Effect.flip)
          ).toBeInstanceOf(PublicRuntimeReadError);
        }
      })
  );
  it.effect(
    "fails closed when the runtime cannot hash the signed projection",
    () =>
      Effect.gen(function* () {
        const row = yield* readFixture();
        vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
          new DOMException(
            "Cryptographic provider unavailable",
            "OperationError"
          )
        );
        expect(
          yield* decodePublicRuntimeRow(row).pipe(Effect.flip)
        ).toBeInstanceOf(PublicRuntimeReadError);
      })
  );
});
