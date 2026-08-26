import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { mcpLegacyPhaseValidator } from "@repo/backend/convex/routes/agent/mcp/schema";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

/** Policy window required before the 2025 protocol can be removed. */
export const MCP_LEGACY_QUIET_WINDOW_MS = 24 * 60 * 60 * 1000;

const LegacyObservationIdSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMaxLength(80),
    Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  ),
  Schema.brand("@Nakafa/McpLegacyObservationId")
);
const legacyControlArgsValidator = v.object({ observationId: v.string() });
const legacyRecordArgsValidator = v.object({});
const legacyRecordResultValidator = v.union(
  v.object({ kind: v.literal("inactive") }),
  v.object({ kind: v.literal("recorded") })
);
const legacyStatusValidator = v.object({
  armedAt: v.number(),
  armedDeploymentName: v.string(),
  invocationCount: v.number(),
  lastInvokedAt: v.optional(v.number()),
  observationId: v.string(),
  phase: mcpLegacyPhaseValidator,
  quietSince: v.number(),
  sealedAt: v.optional(v.number()),
});
const legacyClearReceiptValidator = v.object({
  ...legacyStatusValidator.fields,
  clearedAt: v.number(),
  deleted: v.literal(1),
});

type ReadCtx = MutationCtx | QueryCtx;
type LegacyRead = Doc<"agentMcpLegacyReads">;
export type LegacyControlArgs = Infer<typeof legacyControlArgsValidator>;
export type LegacyClearReceipt = Infer<typeof legacyClearReceiptValidator>;
export type LegacyRecordArgs = Infer<typeof legacyRecordArgsValidator>;
export type LegacyRecordResult = Infer<typeof legacyRecordResultValidator>;
export type LegacyStatus = Infer<typeof legacyStatusValidator>;

/** Expected integrity or lifecycle rejection from the temporary observer. */
class McpLegacyObservationError extends Schema.TaggedError<McpLegacyObservationError>()(
  "McpLegacyObservationError",
  {
    code: Schema.Literals([
      "AGENT_MCP_LEGACY_INTEGRITY",
      "AGENT_MCP_LEGACY_STATE",
    ]),
    message: Schema.String,
  }
) {}

/** Reads the singleton observation and rejects duplicate migration state. */
const loadObservation = Effect.fn("agent.mcp.legacy.load")(function* (
  ctx: ReadCtx
) {
  const rows = yield* Effect.promise(() =>
    ctx.db.query("agentMcpLegacyReads").take(2)
  );
  if (rows.length > 1) {
    return yield* observationFail(
      "AGENT_MCP_LEGACY_INTEGRITY",
      "The MCP legacy observation contains duplicate rows."
    );
  }
  return rows[0] ?? null;
});

/** Requires the exact operator-owned observation row. */
const loadOwnedObservation = Effect.fn("agent.mcp.legacy.loadOwned")(function* (
  ctx: ReadCtx,
  rawObservationId: string
) {
  const observationId = yield* decodeObservationId(rawObservationId);
  const row = yield* loadObservation(ctx);
  if (!row || row.observationId !== observationId) {
    return yield* observationFail(
      "AGENT_MCP_LEGACY_STATE",
      "The requested MCP legacy observation is not active."
    );
  }
  return row;
});

/** Arms one idempotent observation without resetting existing evidence. */
const armObservation = Effect.fn("agent.mcp.legacy.arm")(function* (
  ctx: MutationCtx,
  rawObservationId: string
) {
  const observationId = yield* decodeObservationId(rawObservationId);
  const existing = yield* loadObservation(ctx);
  if (existing) {
    if (existing.observationId !== observationId) {
      return yield* observationFail(
        "AGENT_MCP_LEGACY_STATE",
        "Another MCP legacy observation is already active."
      );
    }
    return statusFields(existing);
  }
  const deployment = yield* Effect.promise(() =>
    ctx.meta.getDeploymentMetadata()
  );
  const armedAt = yield* Clock.currentTimeMillis;
  const row = {
    armedAt,
    armedDeploymentName: deployment.name,
    invocationCount: 0,
    observationId,
    phase: "armed" as const,
    quietSince: armedAt,
  };
  yield* Effect.promise(() => ctx.db.insert("agentMcpLegacyReads", row));
  return statusFields(row);
});

/** Returns durable state without deriving cacheable wall-clock readiness. */
const readObservation = Effect.fn("agent.mcp.legacy.status")(function* (
  ctx: QueryCtx,
  observationId: string
) {
  return statusFields(yield* loadOwnedObservation(ctx, observationId));
});

/** Records one successful 2025 response and reopens late sealed evidence. */
const recordLegacyRead = Effect.fn("agent.mcp.legacy.record")(function* (
  ctx: MutationCtx
) {
  const row = yield* loadObservation(ctx);
  if (!row) {
    return { kind: "inactive" } satisfies LegacyRecordResult;
  }
  if (row.invocationCount >= Number.MAX_SAFE_INTEGER) {
    return yield* observationFail(
      "AGENT_MCP_LEGACY_INTEGRITY",
      "The MCP legacy invocation count exceeded its safe bound."
    );
  }
  const invokedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.patch("agentMcpLegacyReads", row._id, {
      invocationCount: row.invocationCount + 1,
      lastInvokedAt: invokedAt,
      phase: "armed",
      quietSince: invokedAt,
      sealedAt: undefined,
    })
  );
  return { kind: "recorded" } satisfies LegacyRecordResult;
});

/** Seals one exact observation at or after its complete quiet window. */
const sealObservation = Effect.fn("agent.mcp.legacy.seal")(function* (
  ctx: MutationCtx,
  observationId: string
) {
  const row = yield* loadOwnedObservation(ctx, observationId);
  if (row.phase === "sealed") {
    return statusFields(row);
  }
  const sealedAt = yield* Clock.currentTimeMillis;
  if (sealedAt - row.quietSince < MCP_LEGACY_QUIET_WINDOW_MS) {
    return yield* observationFail(
      "AGENT_MCP_LEGACY_STATE",
      "The MCP legacy observation has not completed its quiet window."
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("agentMcpLegacyReads", row._id, {
      phase: "sealed",
      sealedAt,
    })
  );
  return statusFields({ ...row, phase: "sealed", sealedAt });
});

/** Deletes sealed evidence after the deployed route no longer serves legacy. */
const clearObservation = Effect.fn("agent.mcp.legacy.clear")(function* (
  ctx: MutationCtx,
  observationId: string
) {
  const row = yield* loadOwnedObservation(ctx, observationId);
  if (row.phase !== "sealed" || row.sealedAt === undefined) {
    return yield* observationFail(
      "AGENT_MCP_LEGACY_STATE",
      "Only sealed MCP legacy evidence can be cleared."
    );
  }
  const clearedAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() => ctx.db.delete("agentMcpLegacyReads", row._id));
  return { ...statusFields(row), clearedAt, deleted: 1 as const };
});

/** Arms the temporary successful-response observer. */
export const arm = internalMutation({
  args: legacyControlArgsValidator,
  returns: legacyStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(armObservation(ctx, args.observationId)),
});

/** Reads one exact durable observation receipt. */
export const status = internalQuery({
  args: legacyControlArgsValidator,
  returns: legacyStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(readObservation(ctx, args.observationId)),
});

/** Records one successful 2025-era response before returning it publicly. */
export const record = internalMutation({
  args: legacyRecordArgsValidator,
  returns: legacyRecordResultValidator,
  handler: (ctx) => runConvexProgram(recordLegacyRead(ctx)),
});

/** Seals the observer after the full quiet window. */
export const seal = internalMutation({
  args: legacyControlArgsValidator,
  returns: legacyStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(sealObservation(ctx, args.observationId)),
});

/** Clears sealed data only after legacy serving is deployed off. */
export const clear = internalMutation({
  args: legacyControlArgsValidator,
  returns: legacyClearReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(clearObservation(ctx, args.observationId)),
});

/** Decodes one bounded receipt identifier without aliases. */
const decodeObservationId = Effect.fn("agent.mcp.legacy.decodeId")(function* (
  input: string
) {
  return yield* Schema.decodeEffect(LegacyObservationIdSchema)(input).pipe(
    Effect.mapError(() =>
      observationError(
        "AGENT_MCP_LEGACY_INTEGRITY",
        "The MCP legacy observation ID is invalid."
      )
    )
  );
});

/** Selects only durable fields from one stored or pending row. */
function statusFields(row: Omit<LegacyRead, "_creationTime" | "_id">) {
  return {
    armedAt: row.armedAt,
    armedDeploymentName: row.armedDeploymentName,
    invocationCount: row.invocationCount,
    ...(row.lastInvokedAt === undefined
      ? {}
      : { lastInvokedAt: row.lastInvokedAt }),
    observationId: row.observationId,
    phase: row.phase,
    quietSince: row.quietSince,
    ...(row.sealedAt === undefined ? {} : { sealedAt: row.sealedAt }),
  };
}

/** Builds one typed observer failure. */
function observationError(
  code: McpLegacyObservationError["code"],
  message: string
) {
  return new McpLegacyObservationError({ code, message });
}

/** Fails one observer program through the typed Convex boundary. */
function observationFail(
  code: McpLegacyObservationError["code"],
  message: string
) {
  return Effect.fail(observationError(code, message));
}
