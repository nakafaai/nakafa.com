import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranAttribution } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/quran/attribution", () => {
  it("distinguishes unmanaged content from active signed attribution", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.query((ctx) => runConvexProgram(readQuranAttribution(ctx)))
    ).resolves.toMatchObject({ managed: false, rowJson: null });

    const active = convexTest(schema, convexModules);
    const snapshotId = await active.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranAttribution()])
    );
    const result = await active.query((ctx) =>
      runConvexProgram(readQuranAttribution(ctx))
    );
    const decoded = await Effect.runPromise(
      decodeSnapshotRowJson(result.rowJson ?? "")
    );

    expect(result).toMatchObject({ managed: true, snapshotId });
    expect(decoded).toMatchObject({
      family: "quran",
      record: { payload: { kind: "quran-attribution" } },
    });
  });
});
