import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { readQuranAttribution } from "@repo/backend/convex/contentRelease/quran/attribution";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeQuranAttribution } from "@repo/backend/test/quran-rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran-snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/quran/attribution", () => {
  it.live(
    "distinguishes unmanaged content from active signed attribution",
    () =>
      Effect.gen(function* () {
        const empty = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          expect(
            empty.query((ctx) => runConvexProgram(readQuranAttribution(ctx)))
          ).resolves.toMatchObject({ managed: false, rowJson: null })
        );

        const active = convexTest(schema, convexModules);
        const snapshotId = yield* Effect.promise(() =>
          active.mutation((ctx) =>
            activateQuranSnapshot(ctx, [makeQuranAttribution()])
          )
        );
        const result = yield* Effect.promise(() =>
          active.query((ctx) => runConvexProgram(readQuranAttribution(ctx)))
        );
        const decoded = yield* decodeSnapshotRowJson(result.rowJson ?? "");

        expect(result).toMatchObject({ managed: true, snapshotId });
        expect(decoded).toMatchObject({
          family: "quran",
          record: { payload: { kind: "quran-attribution" } },
        });
      })
  );
});
