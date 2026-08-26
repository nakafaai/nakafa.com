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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("registers the complete temporary observation lifecycle", async () => {
    const target = convexTest(schema, convexModules);
    await expect(target.mutation(recordSingular, {})).resolves.toEqual({
      kind: "inactive",
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
      kind: "recorded",
    });
    await expect(target.mutation(recordBatch, {})).resolves.toEqual({
      kind: "recorded",
    });
    await expect(
      target.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: {
        batch: { invocationCount: 1 },
        singular: { invocationCount: 1 },
      },
    });

    vi.setSystemTime(Date.now() + PREDECESSOR_QUIET_WINDOW_MS);
    await expect(
      target.mutation(seal, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: { batch: { phase: "sealed" }, singular: { phase: "sealed" } },
    });
    await expect(target.mutation(recordSingular, {})).resolves.toEqual({
      kind: "recorded",
    });
    await expect(
      target.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: { batch: { phase: "armed" }, singular: { phase: "armed" } },
    });
    vi.setSystemTime(Date.now() + PREDECESSOR_QUIET_WINDOW_MS);
    await target.mutation(seal, { observationId: OBSERVATION_ID });
    await expect(
      target.mutation(clear, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      deleted: 2,
      kind: "cleared",
      observationId: OBSERVATION_ID,
    });
  });
});
