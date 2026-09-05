// @vitest-environment node

import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, beforeEach, describe, expect, it } from "@effect/vitest";
import { readActiveIdentity } from "@repo/backend/content/publication/read";
import { ContentSnapshotError } from "@repo/backend/content/snapshot/error";
import { encodeServingSnapshot } from "@repo/backend/content/snapshot/file";
import { projectActiveRuntime } from "@repo/backend/content/snapshot/projection";
import { buildRuntimeGenerations } from "@repo/backend/content/snapshot/selection";
import {
  CONTENT_SERVING_DATA_FILE,
  CONTENT_SERVING_DESCRIPTOR_FILE,
} from "@repo/backend/content/snapshot/spec";
import { readContentRuntimeSchemaFingerprint } from "@repo/backend/content/snapshot/tables";
import { makePageRuntimeSource } from "@repo/backend/test/content/snapshot";
import { Effect, Schema } from "effect";

const runtimeEnv = vi.hoisted(
  (): {
    CONTENT_BUILD_SNAPSHOT: string | undefined;
    CONTENT_RUNTIME_SELECTION_HASH: string | undefined;
    CONTENT_RUNTIME_SCHEMA_HASH: string | undefined;
  } => ({
    CONTENT_BUILD_SNAPSHOT: undefined,
    CONTENT_RUNTIME_SELECTION_HASH: undefined,
    CONTENT_RUNTIME_SCHEMA_HASH: undefined,
  })
);

vi.mock("@/env", () => ({ env: runtimeEnv }));

beforeEach(() => {
  vi.resetModules();
  runtimeEnv.CONTENT_BUILD_SNAPSHOT = undefined;
  runtimeEnv.CONTENT_RUNTIME_SELECTION_HASH = undefined;
  runtimeEnv.CONTENT_RUNTIME_SCHEMA_HASH = undefined;
});

const servingFixture = Effect.fn("test.workerSnapshot")(function* () {
  const directory = yield* Effect.acquireRelease(
    Effect.promise(() => mkdtemp(join(tmpdir(), "nakafa-worker-snapshot-"))),
    (path) => Effect.promise(() => rm(path, { recursive: true, force: true }))
  );
  const source = makePageRuntimeSource();
  const tables = yield* projectActiveRuntime(source.source);
  const identity = {
    runtimeSchemaFingerprint: yield* readContentRuntimeSchemaFingerprint(),
    runtimeSelectionHash: (yield* buildRuntimeGenerations(tables.contentState))
      .runtimeSelectionHash,
  };
  const encoded = yield* encodeServingSnapshot(tables, identity);
  const path = join(directory, CONTENT_SERVING_DESCRIPTOR_FILE);
  const dataPath = join(directory, CONTENT_SERVING_DATA_FILE);
  yield* Effect.promise(() => writeFile(path, encoded.descriptor));
  yield* Effect.promise(() => writeFile(dataPath, encoded.data));
  const environment = {
    CONTENT_BUILD_SNAPSHOT: path,
    CONTENT_RUNTIME_SELECTION_HASH: identity.runtimeSelectionHash,
    CONTENT_RUNTIME_SCHEMA_HASH: identity.runtimeSchemaFingerprint,
  };
  Object.assign(runtimeEnv, environment);
  const { loadContentSnapshot } = yield* Effect.promise(
    () => import("@/lib/content/runtime/snapshot")
  );
  return {
    ...source,
    directory,
    path,
    dataPath,
    encoded,
    environment,
    loadContentSnapshot,
  };
});

describe("content snapshot worker", () => {
  it("uses native reads before a build snapshot is selected", async () => {
    const { loadContentSnapshot } = await import(
      "@/lib/content/runtime/snapshot"
    );
    await expect(loadContentSnapshot()).resolves.toBeUndefined();
  });

  it.effect(
    "shares one authenticated context across concurrent and later reads",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        const contexts = yield* Effect.promise(() =>
          Promise.all([
            fixture.loadContentSnapshot(),
            fixture.loadContentSnapshot(),
            fixture.loadContentSnapshot(),
          ])
        );
        const [context] = contexts;
        assert.isDefined(context);
        expect(contexts.every((value) => value === context)).toBe(true);
        expect(
          yield* readActiveIdentity().pipe(Effect.provideContext(context))
        ).toEqual({
          manifestHash: fixture.state.activeManifestHash,
          releaseId: fixture.state.activeReleaseId,
          sequence: fixture.state.activeSequence,
        });

        yield* Effect.promise(() =>
          writeFile(fixture.dataPath, "changed after authentication")
        );
        expect(yield* Effect.promise(fixture.loadContentSnapshot)).toBe(
          context
        );
      })
  );

  it.effect(
    "rejects incomplete generation configuration before using snapshot data",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        for (const key of [
          "CONTENT_RUNTIME_SELECTION_HASH",
          "CONTENT_RUNTIME_SCHEMA_HASH",
        ] as const) {
          Object.assign(runtimeEnv, fixture.environment);
          runtimeEnv[key] = undefined;
          yield* Effect.promise(() =>
            expect(fixture.loadContentSnapshot()).rejects.toMatchObject({
              _tag: "ContentSnapshotError",
              message: "The private snapshot has no selected build generation.",
            })
          );
        }
      })
  );

  it.effect(
    "rejects changes to the selected path, generation, schema, or snapshot mode",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        yield* Effect.promise(fixture.loadContentSnapshot);
        const alternatePath = join(fixture.directory, "alternate.json");
        yield* Effect.promise(() =>
          writeFile(alternatePath, fixture.encoded.descriptor)
        );
        for (const changed of [
          { CONTENT_BUILD_SNAPSHOT: alternatePath },
          { CONTENT_RUNTIME_SELECTION_HASH: "0".repeat(64) },
          { CONTENT_RUNTIME_SCHEMA_HASH: "0".repeat(64) },
          { CONTENT_BUILD_SNAPSHOT: undefined },
        ]) {
          Object.assign(runtimeEnv, fixture.environment, changed);
          yield* Effect.promise(() =>
            expect(fixture.loadContentSnapshot()).rejects.toMatchObject({
              _tag: "ContentSnapshotError",
              message: "The signed build snapshot changed within one worker.",
            })
          );
        }
      })
  );

  it.effect(
    "rejects changed descriptor bytes even when their generation is unchanged",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        yield* Effect.promise(fixture.loadContentSnapshot);
        yield* Effect.promise(() =>
          writeFile(fixture.path, `${fixture.encoded.descriptor}\n`)
        );

        yield* Effect.promise(() =>
          expect(fixture.loadContentSnapshot()).rejects.toMatchObject({
            _tag: "ContentSnapshotError",
            message: "The signed build snapshot changed within one worker.",
          })
        );
      })
  );

  it.effect(
    "preserves a typed descriptor read failure at the Promise boundary",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        yield* Effect.promise(() => unlink(fixture.path));

        yield* Effect.promise(() =>
          expect(fixture.loadContentSnapshot()).rejects.toMatchObject({
            _tag: "ContentSnapshotError",
            message: "The private snapshot descriptor could not be read.",
          })
        );
      })
  );

  it.effect(
    "keeps a failed data read selected even if the file is later restored",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        yield* Effect.promise(() => unlink(fixture.dataPath));
        const failure = Effect.tryPromise({
          try: fixture.loadContentSnapshot,
          catch: (cause) => {
            assert(Schema.is(ContentSnapshotError)(cause));
            return cause;
          },
        }).pipe(Effect.flip);
        const first = yield* failure;
        expect(first).toMatchObject({
          _tag: "ContentSnapshotError",
          message: "The private snapshot data could not be read.",
        });
        yield* Effect.promise(() =>
          writeFile(fixture.dataPath, fixture.encoded.data)
        );
        expect(yield* failure).toBe(first);
      })
  );

  it.effect(
    "shares an authentication failure without retrying or switching to live data",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        yield* Effect.promise(() =>
          writeFile(fixture.dataPath, `${fixture.encoded.data} `)
        );
        const failure = Effect.tryPromise({
          try: fixture.loadContentSnapshot,
          catch: (cause) => {
            assert(Schema.is(ContentSnapshotError)(cause));
            return cause;
          },
        }).pipe(Effect.flip);
        const failures = yield* Effect.all([failure, failure], {
          concurrency: "unbounded",
        });
        expect(failures[0]).toMatchObject({
          _tag: "ContentSnapshotError",
          message:
            "Serving snapshot data failed its descriptor integrity check.",
        });
        expect(failures[1]).toBe(failures[0]);
        yield* Effect.promise(() =>
          writeFile(fixture.dataPath, fixture.encoded.data)
        );
        expect(yield* failure).toBe(failures[0]);

        runtimeEnv.CONTENT_BUILD_SNAPSHOT = undefined;
        expect(yield* failure).toMatchObject({
          _tag: "ContentSnapshotError",
          message: "The signed build snapshot changed within one worker.",
        });
      })
  );

  it.effect(
    "rejects a valid file authenticated for another expected generation",
    () =>
      Effect.gen(function* () {
        const fixture = yield* servingFixture();
        runtimeEnv.CONTENT_RUNTIME_SELECTION_HASH = "0".repeat(64);
        yield* Effect.promise(() =>
          expect(fixture.loadContentSnapshot()).rejects.toMatchObject({
            _tag: "ContentSnapshotError",
            message:
              "The private snapshot differs from the selected build generation.",
          })
        );
      })
  );
});
