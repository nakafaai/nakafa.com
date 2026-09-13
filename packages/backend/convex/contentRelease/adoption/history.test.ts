import { describe, expect, it } from "@effect/vitest";
import {
  hashHistory,
  readHistory,
} from "@repo/backend/convex/contentRelease/adoption/history";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertAdoptionHistory } from "@repo/backend/test/content/adoption";
import { Effect } from "effect";

describe("contentRelease/adoption/history", () => {
  it.effect(
    "fingerprints every stored learner value independently of row ordering",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const fixture = yield* Effect.promise(() =>
          t.mutation((ctx) => insertAdoptionHistory(ctx))
        );
        const entry = fixture.state.history.entries[0];
        if (!entry) {
          throw new Error("Expected technical history.");
        }
        const history = {
          entries: [entry, entry],
          scaleEntries: [
            ...fixture.state.history.scaleEntries,
            ...fixture.state.history.scaleEntries,
          ],
        };
        expect(yield* hashHistory(history)).toBe(
          yield* hashHistory({
            ...history,
            entries: [...history.entries].reverse(),
          })
        );
        const response = entry.responses[0];
        if (!response) {
          throw new Error("Expected technical response.");
        }
        const { _id, _creationTime, ...fields } = response;
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.insert("tryoutResponses", {
              ...fields,
              answeredAt: fields.answeredAt + 1,
            })
          )
        );
        const changed = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              readHistory(ctx, fixture.state.oldBundle.snapshotId)
            )
          )
        );
        const first = changed.entries[0];
        if (!first) {
          throw new Error("Expected reordered responses.");
        }
        expect(yield* hashHistory(changed)).toBe(
          yield* hashHistory({
            ...changed,
            entries: [{ ...first, responses: [...first.responses].reverse() }],
          })
        );
        expect(yield* hashHistory(changed)).not.toBe(fixture.state.historyHash);
      })
  );

  it("rejects absent history, incomplete attempts, changed scoring and missing scale items", async () => {
    for (const change of ["missing", "status", "score", "items"] as const) {
      const t = createConvexTestWithBetterAuth();
      const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
      await t.mutation(async (ctx) => {
        if (change === "status") {
          await ctx.db.patch("tryoutAttempts", fixture.seed.request.attemptId, {
            status: "in-progress",
          });
        } else if (change === "score") {
          await ctx.db.patch("tryoutScores", fixture.scoreId, {
            tryoutSnapshotId: "different",
          });
        } else if (change === "items") {
          await ctx.db.delete("irtScaleItems", fixture.itemId);
        }
      });
      await expect(
        t.query((ctx) =>
          runConvexProgram(
            readHistory(
              ctx,
              change === "missing"
                ? "missing"
                : fixture.state.oldBundle.snapshotId
            )
          )
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    }
  });

  it("rejects a scale moved outside the exact adoption snapshot", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation((ctx) => insertAdoptionHistory(ctx));
    await t.mutation((ctx) =>
      ctx.db.patch("irtScaleVersions", fixture.scaleId, {
        tryoutSnapshotId: "outside",
      })
    );
    await expect(
      t.query((ctx) =>
        runConvexProgram(readHistory(ctx, fixture.state.oldBundle.snapshotId))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });
});
