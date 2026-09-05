import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import {
  decodePublicRuntimeRow,
  PublicRuntimeReadError,
} from "@repo/backend/content/publication/exchange";
import { resolvePublicRoute } from "@repo/backend/content/publication/public";
import { snapshotPublicationLayer } from "@repo/backend/content/publication/snapshot";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { TEST_QUESTION_PROJECTION_JSON } from "@repo/backend/test/content/question";
import { makePageRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Effect } from "effect";

const readFixture = Effect.fn("test.publicationExchange")(function* () {
  const fixture = makePageRuntimeSource();
  const tables = yield* projectActiveRuntime(fixture.source);
  const row = yield* resolvePublicRoute(
    fixture.projection.appLocale,
    fixture.projection.publicPath
  ).pipe(Effect.provide(snapshotPublicationLayer(tables)));
  assert(row, "Expected one signed public page.");
  return row;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stored public exchange", () => {
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
        expect(response?.artifact).toEqual(JSON.parse(row.artifactJson));
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
          { artifactJson: "{" },
          { projectionJson: "{" },
          { releaseJson: "{" },
          { rendererJson: "{" },
          { sourcePath: "outside-corpus.mdx" },
          { projectionHash: "not-a-digest" },
          { projectionHash: differentHash },
          { activeManifestHash: differentHash },
          { activeReleaseId: "different-release" },
          { projectionJson: TEST_QUESTION_PROJECTION_JSON },
        ]) {
          expect(
            yield* decodePublicRuntimeRow({ ...row, ...patch }).pipe(
              Effect.flip
            )
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
