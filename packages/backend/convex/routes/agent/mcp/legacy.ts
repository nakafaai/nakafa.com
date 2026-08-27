import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { mcpLegacyPhaseValidator } from "@repo/backend/convex/routes/agent/mcp/schema";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

const LegacyObservationIdSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMaxLength(80),
    Schema.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  ),
  Schema.brand("@Nakafa/McpLegacyObservationId")
);
const legacyRetireArgsValidator = v.object({ observationId: v.string() });
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
const legacyRetireReceiptValidator = v.object({
  ...legacyStatusValidator.fields,
  deleted: v.literal(1),
  retiredAt: v.number(),
});

type LegacyRead = Doc<"agentMcpLegacyReads">;
export type LegacyRetireArgs = Infer<typeof legacyRetireArgsValidator>;
export type LegacyRetireReceipt = Infer<typeof legacyRetireReceiptValidator>;

/** Expected failure while retiring the temporary predecessor receipt. */
class McpLegacyRetirementError extends Schema.TaggedError<McpLegacyRetirementError>()(
  "McpLegacyRetirementError",
  {
    code: Schema.Literals([
      "AGENT_MCP_LEGACY_INTEGRITY",
      "AGENT_MCP_LEGACY_STATE",
    ]),
    message: Schema.String,
  }
) {}

/** Deletes the exact operator-owned receipt after modern-only serving is live. */
const retireObservation = Effect.fn("agent.mcp.legacy.retire")(function* (
  ctx: MutationCtx,
  rawObservationId: string
) {
  const observationId = yield* decodeObservationId(rawObservationId);
  const rows = yield* Effect.promise(() =>
    ctx.db.query("agentMcpLegacyReads").take(2)
  );
  if (rows.length > 1) {
    return yield* retirementFail(
      "AGENT_MCP_LEGACY_INTEGRITY",
      "The MCP predecessor receipt contains duplicate rows."
    );
  }
  const row = rows[0];
  if (!row || row.observationId !== observationId) {
    return yield* retirementFail(
      "AGENT_MCP_LEGACY_STATE",
      "The requested MCP predecessor receipt is not active."
    );
  }
  const retiredAt = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() => ctx.db.delete("agentMcpLegacyReads", row._id));
  return {
    ...statusFields(row),
    deleted: 1 as const,
    retiredAt,
  } satisfies LegacyRetireReceipt;
});

/** One-time cleanup function deleted with the observer table after cutover. */
export const retire = internalMutation({
  args: legacyRetireArgsValidator,
  returns: legacyRetireReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(retireObservation(ctx, args.observationId)),
});

/** Decodes the exact bounded observation identity. */
const decodeObservationId = Effect.fn("agent.mcp.legacy.decodeId")(function* (
  input: string
) {
  return yield* Schema.decodeEffect(LegacyObservationIdSchema)(input).pipe(
    Effect.mapError(() =>
      retirementError(
        "AGENT_MCP_LEGACY_INTEGRITY",
        "The MCP predecessor receipt ID is invalid."
      )
    )
  );
});

/** Selects the server-derived evidence returned immediately before deletion. */
function statusFields(row: LegacyRead) {
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

/** Builds one typed retirement failure. */
function retirementError(
  code: McpLegacyRetirementError["code"],
  message: string
) {
  return new McpLegacyRetirementError({ code, message });
}

/** Fails one retirement program through the typed Convex boundary. */
function retirementFail(
  code: McpLegacyRetirementError["code"],
  message: string
) {
  return Effect.fail(retirementError(code, message));
}
