// @vitest-environment node

import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readSnapshotWindow } from "@repo/backend/confect/contentRelease/proof/window";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/proof/window", () => {
  it.live(
    "reads a window of batches across pages its byte budget stops early",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        // Three batches hold the fixture: two full ones and the rest.
        const batchSize = Math.ceil(data.rowJson.length / 3);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageProgramSnapshot(data, batchSize).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const readWindow = (batches: number) =>
          t.action((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              readSnapshotWindow("release-test", "program", 0, batches, 1).pipe(
                Effect.provide(
                  RegisteredFunction.actionLayer(confectSchema, ctx)
                )
              )
            )
          );
        // A one-byte budget stops every page after one batch.
        yield* Effect.promise(() =>
          expect(readWindow(3)).resolves.toEqual(data.rowJson)
        );
        // A window naming a batch the ledger never staged fails.
        yield* Effect.promise(() =>
          expect(readWindow(4)).rejects.toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          })
        );
      })
  );
});
