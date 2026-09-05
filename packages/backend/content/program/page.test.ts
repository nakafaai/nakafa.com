import { describe, expect, it } from "@effect/vitest";
import { convexProgramLayer } from "@repo/backend/content/program/convex";
import { readProgramPage } from "@repo/backend/content/program/page";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/program/page", () => {
  it("returns an empty unmanaged page before program publication", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramPage("en", null, null, {
            cursor: null,
            numItems: 2,
          }).pipe(Effect.provide(convexProgramLayer(ctx)))
        )
      )
    ).resolves.toMatchObject({
      managed: false,
      result: { isDone: true, page: [] },
    });
  });

  it.live(
    "paginates verified localized routes under one release identity",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        const first = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readProgramPage("en", null, null, {
                cursor: null,
                numItems: 1,
              }).pipe(Effect.provide(convexProgramLayer(ctx)))
            )
          )
        );
        const firstRow = yield* decodeSnapshotRowJson(
          first.result.page[0] ?? ""
        );
        expect(first).toMatchObject({
          activeManifestHash: TEST_MANIFEST_HASH,
          activeReleaseId: TEST_RELEASE_ID,
          managed: true,
          result: { isDone: false },
          snapshotId: data.snapshotId,
          sourceRevision: "a".repeat(40),
          stale: false,
        });
        expect(firstRow).toMatchObject({
          family: "program",
          record: { kind: "curriculum", row: { appLocale: "en" } },
        });

        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readProgramPage("en", TEST_MANIFEST_HASH, TEST_RELEASE_ID, {
                  cursor: first.result.continueCursor,
                  numItems: 1,
                }).pipe(Effect.provide(convexProgramLayer(ctx)))
              )
            )
          ).resolves.toMatchObject({
            managed: true,
            result: { isDone: true, page: [expect.any(String)] },
            stale: false,
          })
        );
      })
  );

  it.live(
    "returns a stable stale page for a superseded continuation identity",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgramSnapshot(t, data));
        const first = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readProgramPage("en", null, null, {
                cursor: null,
                numItems: 1,
              }).pipe(Effect.provide(convexProgramLayer(ctx)))
            )
          )
        );

        yield* Effect.promise(() =>
          expect(
            t.query((ctx) =>
              runConvexProgram(
                readProgramPage("en", "stale-manifest", "stale-release", {
                  cursor: first.result.continueCursor,
                  numItems: 1,
                }).pipe(Effect.provide(convexProgramLayer(ctx)))
              )
            )
          ).resolves.toMatchObject({
            activeReleaseId: TEST_RELEASE_ID,
            managed: true,
            result: { isDone: true, page: [] },
            stale: true,
          })
        );
      })
  );
});
