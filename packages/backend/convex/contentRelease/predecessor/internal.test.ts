import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import {
  PREDECESSOR_QUIET_WINDOW_MS,
  type PredecessorAbandonReceipt,
  type PredecessorObservationArgs,
  type PredecessorRecordArgs,
  type PredecessorRecordResult,
  type PredecessorStatus,
} from "@repo/backend/convex/contentRelease/predecessor/spec";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeRelease } from "@repo/backend/test/content/runtime";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const OBSERVATION_ID = "test-predecessor-observation";
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
const recordProtected = makeFunctionReference<
  "mutation",
  PredecessorRecordArgs,
  PredecessorRecordResult
>("contentRelease/predecessor/internal:recordProtected");
const seal = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorStatus
>("contentRelease/predecessor/internal:seal");
const abandon = makeFunctionReference<
  "mutation",
  PredecessorObservationArgs,
  PredecessorAbandonReceipt
>("contentRelease/predecessor/internal:abandon");

describe("contentRelease/predecessor/internal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("registers observation controls and preserves active evidence", async () => {
    const target = convexTest(schema, convexModules);
    await expect(target.mutation(recordProtected, {})).resolves.toEqual({
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
    await expect(target.mutation(recordProtected, {})).resolves.toEqual({
      kind: "recorded",
    });
    await expect(
      target.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: {
        batch: { invocationCount: 0 },
        history: { invocationCount: 0 },
        protected: { invocationCount: 1 },
        singular: { invocationCount: 0 },
      },
    });

    vi.setSystemTime(Date.now() + PREDECESSOR_QUIET_WINDOW_MS);
    await expect(
      target.mutation(seal, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: { batch: { phase: "sealed" }, singular: { phase: "sealed" } },
    });
    await expect(target.mutation(recordProtected, {})).resolves.toEqual({
      kind: "recorded",
    });
    await expect(
      target.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: {
        batch: { phase: "armed" },
        history: { phase: "armed" },
        protected: { invocationCount: 2, phase: "armed" },
        singular: { phase: "armed" },
      },
    });
    vi.setSystemTime(Date.now() + PREDECESSOR_QUIET_WINDOW_MS);
    await target.mutation(seal, { observationId: OBSERVATION_ID });
    await expect(
      target.mutation(abandon, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
    await expect(
      target.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      routes: { batch: { phase: "sealed" }, singular: { phase: "sealed" } },
    });
  });
});
