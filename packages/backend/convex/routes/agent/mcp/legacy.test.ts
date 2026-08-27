// @vitest-environment node

import type {
  LegacyRetireArgs,
  LegacyRetireReceipt,
} from "@repo/backend/convex/routes/agent/mcp/legacy";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "@repo/testing/effect";
import { makeFunctionReference } from "convex/server";
import { vi } from "vitest";

const OBSERVATION_ID = "mcp-direct-1f955564";
const retire = makeFunctionReference<
  "mutation",
  LegacyRetireArgs,
  LegacyRetireReceipt
>("routes/agent/mcp/legacy:retire");

describe("MCP predecessor retirement", () => {
  it("returns the server receipt and deletes the exact owned row", async () => {
    vi.useFakeTimers();
    const retiredAt = Date.UTC(2026, 7, 27, 12);
    vi.setSystemTime(retiredAt);
    const test = createConvexTestWithBetterAuth();
    const row = observationRow();
    await test.mutation((ctx) => ctx.db.insert("agentMcpLegacyReads", row));

    await expect(
      test.mutation(retire, { observationId: OBSERVATION_ID })
    ).resolves.toEqual({ ...row, deleted: 1, retiredAt });
    await expect(
      test.run((ctx) => ctx.db.query("agentMcpLegacyReads").collect())
    ).resolves.toEqual([]);

    vi.useRealTimers();
  });

  it("rejects invalid, missing, competing, and duplicate receipts", async () => {
    const test = createConvexTestWithBetterAuth();
    await expect(
      test.mutation(retire, { observationId: "Invalid ID" })
    ).rejects.toMatchObject({
      data: { code: "AGENT_MCP_LEGACY_INTEGRITY" },
    });
    await expect(
      test.mutation(retire, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "AGENT_MCP_LEGACY_STATE" } });

    const row = observationRow();
    await test.mutation((ctx) => ctx.db.insert("agentMcpLegacyReads", row));
    await expect(
      test.mutation(retire, { observationId: "competing-observation" })
    ).rejects.toMatchObject({ data: { code: "AGENT_MCP_LEGACY_STATE" } });
    await test.mutation((ctx) => ctx.db.insert("agentMcpLegacyReads", row));
    await expect(
      test.mutation(retire, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({
      data: { code: "AGENT_MCP_LEGACY_INTEGRITY" },
    });
    await expect(
      test.run((ctx) => ctx.db.query("agentMcpLegacyReads").collect())
    ).resolves.toHaveLength(2);
  });
});

function observationRow() {
  return {
    armedAt: 1_787_799_652_585,
    armedDeploymentName: "dapper-antelope-269",
    invocationCount: 126,
    lastInvokedAt: 1_787_824_259_764,
    observationId: OBSERVATION_ID,
    phase: "armed" as const,
    quietSince: 1_787_824_259_764,
  };
}
