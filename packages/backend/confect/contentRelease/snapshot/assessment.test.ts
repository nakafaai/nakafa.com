import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { assessmentRowIdentity } from "@nakafa/aksara-contracts/assessment/snapshot";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { stageAssessmentRow } from "@repo/backend/confect/contentRelease/snapshot/assessment";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { convexTest } from "convex-test";
import { Array as Arr, Effect } from "effect";

const snapshotId = Sha256HashSchema.make(`sha256:${"7".repeat(64)}`);

describe("contentRelease/snapshot/assessment", () => {
  it.effect(
    "replays an immutable row exactly and rejects index or stored-byte collisions",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const { rows } = yield* makeAssessmentTestSnapshot();
        const row = yield* Effect.fromOption(
          Arr.findFirst(rows, ({ record }) => record.row.kind === "item")
        );
        const rowJson = canonicalizeContentSnapshotRow(row);
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          const stage = (index: number) =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                stageAssessmentRow(snapshotId, index, row.record, rowJson).pipe(
                  Effect.provide(
                    RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                  )
                )
              )
            );
          const stored = () =>
            t.query((ctx) => ctx.db.query("assessmentRows").collect());
          await expect(stage(1)).resolves.toBe(false);
          const original = await stored();
          expect(original).toMatchObject([
            {
              identity: assessmentRowIdentity(row.record.row),
              index: 1,
              kind: "item",
              rowHash: row.record.rowHash,
              rowJson,
              snapshotId,
            },
          ]);
          await expect(stage(1)).resolves.toBe(true);
          expect(await stored()).toEqual(original);
          await expect(stage(2)).rejects.toMatchObject({
            code: "CONTENT_RELEASE_CONFLICT",
          });
          await t.mutation(async (ctx) => {
            const [first] = await ctx.db.query("assessmentRows").collect();
            assert(first);
            await ctx.db.patch(first._id, { rowJson: "{}" });
          });
          const changed = await stored();
          await expect(stage(1)).rejects.toMatchObject({
            code: "CONTENT_RELEASE_CONFLICT",
          });
          expect(await stored()).toEqual(changed);
        });
      })
  );
});
