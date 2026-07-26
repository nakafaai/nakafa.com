import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readProgramPage } from "@repo/backend/convex/contentRelease/program/page";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/program/page", () => {
  it("returns an empty unmanaged page before program publication", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramPage(ctx, "en", null, null, {
            cursor: null,
            numItems: 2,
          })
        )
      )
    ).resolves.toMatchObject({
      managed: false,
      result: { isDone: true, page: [] },
    });
  });

  it("paginates verified localized routes under one release identity", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const first = await t.query((ctx) =>
      runConvexProgram(
        readProgramPage(ctx, "en", null, null, {
          cursor: null,
          numItems: 1,
        })
      )
    );
    const firstRow = await Effect.runPromise(
      decodeSnapshotRowJson(first.result.page[0] ?? "")
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
      record: { kind: "curriculum", row: { locale: "en" } },
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramPage(ctx, "en", TEST_MANIFEST_HASH, TEST_RELEASE_ID, {
            cursor: first.result.continueCursor,
            numItems: 1,
          })
        )
      )
    ).resolves.toMatchObject({
      managed: true,
      result: { isDone: true, page: [expect.any(String)] },
      stale: false,
    });
  });

  it("returns a stable stale page for a superseded continuation identity", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await activateProgramSnapshot(t, data);
    const first = await t.query((ctx) =>
      runConvexProgram(
        readProgramPage(ctx, "en", null, null, {
          cursor: null,
          numItems: 1,
        })
      )
    );

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readProgramPage(ctx, "en", "stale-manifest", "stale-release", {
            cursor: first.result.continueCursor,
            numItems: 1,
          })
        )
      )
    ).resolves.toMatchObject({
      activeReleaseId: TEST_RELEASE_ID,
      managed: true,
      result: { isDone: true, page: [] },
      stale: true,
    });
  });
});
