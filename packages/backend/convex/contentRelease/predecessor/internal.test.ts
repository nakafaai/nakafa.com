import {
  PREDECESSOR_QUIET_WINDOW_MS,
  type PredecessorClearReceipt,
  type PredecessorObservationArgs,
  type PredecessorRecordArgs,
  type PredecessorRecordResult,
  type PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeRelease } from "@repo/backend/test/content-runtime";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const OBSERVATION_ID = "dates-cutover-4974ee8c";
const arm = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:arm");
const status = makeFunctionReference<
  "query",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:status");
const recordSingular = makeFunctionReference<
  "mutation",
  PredecessorRecordArgs,
  PredecessorRecordResult
>("contentRelease/predecessor/internal:recordSingular");
const recordBatch = makeFunctionReference<
  "mutation",
  PredecessorRecordArgs,
  PredecessorRecordResult
>("contentRelease/predecessor/internal:recordBatch");
const seal = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:seal");
const clear = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorClearReceipt
>("contentRelease/predecessor/internal:clear");

describe("contentRelease/predecessor/internal", () => {
  it("registers the complete temporary observation lifecycle", async () => {
    const target = convexTest(schema, convexModules);
    await expect(target.mutation(recordSingular, {})).resolves.toEqual({
      observed: false,
    });
    await target.mutation((ctx) => insertRuntimeRelease(ctx));

    const armed = await target.mutation(arm, {
      observationId: OBSERVATION_ID,
    });
    expect(armed.observationId).toBe(OBSERVATION_ID);
    await expect(
      target.mutation(arm, { observationId: OBSERVATION_ID })
    ).resolves.toEqual(armed);
    await expect(target.mutation(recordSingular, {})).resolves.toEqual({
      observed: true,
    });
    await expect(target.mutation(recordBatch, {})).resolves.toEqual({
      observed: true,
    });
    await expect(
      target.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: {
        batch: { invocationCount: 1 },
        singular: { invocationCount: 1 },
      },
    });

    await target.mutation(async (ctx) => {
      const rows = await ctx.db.query("contentPredecessorReads").collect();
      for (const row of rows) {
        await ctx.db.patch("contentPredecessorReads", row._id, {
          quietSince: Date.now() - PREDECESSOR_QUIET_WINDOW_MS,
        });
      }
    });
    await expect(
      target.mutation(seal, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: { batch: { phase: "sealed" }, singular: { phase: "sealed" } },
    });
    await expect(
      target.mutation(clear, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({ deleted: 2, observationId: OBSERVATION_ID });
  });
});
