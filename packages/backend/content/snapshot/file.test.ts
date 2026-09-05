import { createHash } from "node:crypto";
import { describe, expect, it } from "@effect/vitest";
import { readActiveIdentity } from "@repo/backend/content/publication/read";
import { createSnapshotContext } from "@repo/backend/content/snapshot/context";
import {
  decodeServingDescriptor,
  decodeServingSnapshot,
  encodeServingSnapshot,
} from "@repo/backend/content/snapshot/file";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { buildRuntimeGenerations } from "@repo/backend/content/snapshot/selection";
import { readContentRuntimeSchemaFingerprint } from "@repo/backend/content/snapshot/tables";
import { makePageRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Effect } from "effect";

const fixture = Effect.fn("test.servingSnapshot")(function* () {
  const source = makePageRuntimeSource();
  const tables = yield* projectActiveRuntime(source.source);
  const identity = {
    runtimeSchemaFingerprint: yield* readContentRuntimeSchemaFingerprint(),
    runtimeSelectionHash: (yield* buildRuntimeGenerations(tables.contentState))
      .runtimeSelectionHash,
  };
  const encoded = yield* encodeServingSnapshot(tables, identity);
  const descriptor = yield* decodeServingDescriptor(encoded.descriptor);
  return { ...source, tables, identity, encoded, descriptor };
});

const hash = (data: string) => createHash("sha256").update(data).digest("hex");

describe("private serving snapshot", () => {
  it.effect(
    "preserves authenticated serving bytes and constructs the exact active read context",
    () =>
      Effect.gen(function* () {
        const source = yield* fixture();
        expect(
          yield* decodeServingSnapshot(source.encoded.data, source.descriptor)
        ).toEqual(source.tables);
        const context = yield* createSnapshotContext(
          source.encoded.descriptor,
          source.encoded.data,
          source.identity
        );
        expect(
          yield* readActiveIdentity().pipe(Effect.provideContext(context))
        ).toEqual({
          manifestHash: source.state.activeManifestHash,
          releaseId: source.state.activeReleaseId,
          sequence: source.state.activeSequence,
        });
      })
  );

  it.effect(
    "rejects a valid snapshot selected for another build generation",
    () =>
      Effect.gen(function* () {
        const { encoded, identity } = yield* fixture();
        for (const expected of [
          { ...identity, runtimeSelectionHash: "0".repeat(64) },
          { ...identity, runtimeSchemaFingerprint: "0".repeat(64) },
        ]) {
          expect(
            yield* createSnapshotContext(
              encoded.descriptor,
              encoded.data,
              expected
            ).pipe(Effect.flip)
          ).toMatchObject({
            message:
              "The private snapshot differs from the selected build generation.",
          });
        }
      })
  );

  it.effect(
    "rejects descriptor paths, extra properties and malformed JSON",
    () =>
      Effect.gen(function* () {
        const { descriptor } = yield* fixture();
        for (const value of [
          "{",
          JSON.stringify({ ...descriptor, dataFile: "../data.json" }),
          JSON.stringify({ ...descriptor, unexpected: true }),
        ]) {
          expect(
            yield* decodeServingDescriptor(value).pipe(Effect.flip)
          ).toMatchObject({
            _tag: "ContentSnapshotError",
            message: "Serving snapshot descriptor is invalid.",
          });
        }
      })
  );

  it.effect(
    "rejects incomplete and mismatched generation identities before encoding",
    () =>
      Effect.gen(function* () {
        const { tables, identity } = yield* fixture();
        expect(
          yield* encodeServingSnapshot(tables, {
            ...identity,
            runtimeSelectionHash: "invalid",
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentSnapshotError",
          message: "Serving snapshot metadata is invalid.",
        });
        expect(
          yield* encodeServingSnapshot(tables, {
            ...identity,
            runtimeSelectionHash: "0".repeat(64),
          }).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentSnapshotError",
        });
      })
  );

  it.effect("rejects changed bytes and another installed runtime schema", () =>
    Effect.gen(function* () {
      const { encoded, descriptor } = yield* fixture();
      expect(
        yield* decodeServingSnapshot(`${encoded.data} `, descriptor).pipe(
          Effect.flip
        )
      ).toMatchObject({
        message: "Serving snapshot data failed its descriptor integrity check.",
      });
      expect(
        yield* decodeServingSnapshot(encoded.data, {
          ...descriptor,
          runtimeSchemaFingerprint: "0".repeat(64),
        }).pipe(Effect.flip)
      ).toMatchObject({
        message: "Serving snapshot data uses a different runtime schema.",
      });
    })
  );

  it.effect("validates table shape even when the outer digest matches", () =>
    Effect.gen(function* () {
      const { descriptor } = yield* fixture();
      for (const data of ["{", JSON.stringify({ contentState: [42] })]) {
        expect(
          yield* decodeServingSnapshot(data, {
            ...descriptor,
            dataSha256: hash(data),
          }).pipe(Effect.flip)
        ).toMatchObject({
          message: "Serving snapshot data does not satisfy its table contract.",
        });
      }
    })
  );

  it.effect(
    "rejects rows outside the selected generation even with a matching digest",
    () =>
      Effect.gen(function* () {
        const { tables, descriptor } = yield* fixture();
        const data = JSON.stringify({
          ...tables,
          contentArtifacts: [
            ...tables.contentArtifacts,
            {
              artifactHash: "orphan",
              artifactJson: "not served",
              createdAt: 1,
              retainUntil: 2,
            },
          ],
        });
        expect(
          yield* decodeServingSnapshot(data, {
            ...descriptor,
            dataSha256: hash(data),
          }).pipe(Effect.flip)
        ).toMatchObject({
          message:
            "Serving snapshot data contains rows outside its selected generation.",
        });
      })
  );
});
