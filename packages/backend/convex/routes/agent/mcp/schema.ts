import { defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Durable phases of the temporary 2025 protocol observation. */
export const mcpLegacyPhaseValidator = literals("armed", "sealed");

const tables = {
  /** Temporary exact counter for authenticated 2025-era MCP responses. */
  agentMcpLegacyReads: defineTable({
    armedAt: v.number(),
    armedDeploymentName: v.string(),
    invocationCount: v.number(),
    lastInvokedAt: v.optional(v.number()),
    observationId: v.string(),
    phase: mcpLegacyPhaseValidator,
    quietSince: v.number(),
    sealedAt: v.optional(v.number()),
  }),
};

export default tables;
