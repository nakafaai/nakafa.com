// @vitest-environment node

import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  LATEST_PROTOCOL_VERSION as MCP_PREDECESSOR_PROTOCOL_VERSION,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import {
  type LegacyClearReceipt,
  type LegacyControlArgs,
  type LegacyRecordArgs,
  type LegacyRecordResult,
  type LegacyStatus,
  MCP_LEGACY_QUIET_WINDOW_MS,
} from "@repo/backend/convex/routes/agent/mcp/legacy";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { makeFunctionReference } from "convex/server";
import { vi } from "vitest";

const MCP_SECRET = "technical-mcp-edge-secret";
const OBSERVATION_ID = "mcp-protocol-cutover";
const COMPETING_OBSERVATION_ID = "another-mcp-cutover";
const arm = makeFunctionReference<"mutation", LegacyControlArgs, LegacyStatus>(
  "routes/agent/mcp/legacy:arm"
);
const status = makeFunctionReference<"query", LegacyControlArgs, LegacyStatus>(
  "routes/agent/mcp/legacy:status"
);
const record = makeFunctionReference<
  "mutation",
  LegacyRecordArgs,
  LegacyRecordResult
>("routes/agent/mcp/legacy:record");
const seal = makeFunctionReference<"mutation", LegacyControlArgs, LegacyStatus>(
  "routes/agent/mcp/legacy:seal"
);
const clear = makeFunctionReference<
  "mutation",
  LegacyControlArgs,
  LegacyClearReceipt
>("routes/agent/mcp/legacy:clear");
type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;

function postMcpSource(test: BackendTest, body: string, modern = false) {
  const headers = new Headers({
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    [NAKAFA_MCP_EDGE_CONTRACT.secretHeader]: MCP_SECRET,
    "x-forwarded-for": "203.0.113.22",
  });
  if (modern) {
    headers.set("mcp-protocol-version", NAKAFA_MCP_PROTOCOL_VERSION);
    headers.set("mcp-method", "server/discover");
  }
  return test.fetch(NAKAFA_MCP_EDGE_CONTRACT.originPath, {
    body,
    headers,
    method: "POST",
  });
}

function postMcp(test: BackendTest, body: unknown, modern = false) {
  return postMcpSource(test, JSON.stringify(body), modern);
}

function initializeBody(id: number) {
  return {
    id,
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      capabilities: {},
      clientInfo: { name: "predecessor-test", version: "1.0.0" },
      protocolVersion: MCP_PREDECESSOR_PROTOCOL_VERSION,
    },
  };
}

beforeEach(() => {
  vi.stubEnv(NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment, MCP_SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("MCP predecessor observation", () => {
  it("arms idempotently and rejects invalid or competing ownership", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 26, 8));
    const test = createConvexTestWithBetterAuth();

    await expect(test.mutation(record, {})).resolves.toEqual({
      kind: "inactive",
    });
    await expect(
      test.mutation(arm, { observationId: "Invalid ID" })
    ).rejects.toMatchObject({
      data: { code: "AGENT_MCP_LEGACY_INTEGRITY" },
    });

    const armed = await test.mutation(arm, { observationId: OBSERVATION_ID });
    expect(armed).toMatchObject({
      armedDeploymentName: "test",
      invocationCount: 0,
      observationId: OBSERVATION_ID,
      phase: "armed",
    });
    await expect(
      test.mutation(arm, { observationId: OBSERVATION_ID })
    ).resolves.toEqual(armed);
    await expect(
      test.mutation(arm, { observationId: COMPETING_OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "AGENT_MCP_LEGACY_STATE" } });
    await expect(
      test.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toEqual(armed);
  });

  it("counts only successful predecessor responses and fails closed", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(arm, { observationId: OBSERVATION_ID });

    const malformed = await postMcpSource(test, "{");
    expect(malformed.status).toBe(400);
    const modern = await postMcp(
      test,
      {
        id: 1,
        jsonrpc: "2.0",
        method: "server/discover",
        params: {
          _meta: {
            [CLIENT_CAPABILITIES_META_KEY]: {},
            [CLIENT_INFO_META_KEY]: {
              name: "current-test",
              version: "1.0.0",
            },
            [PROTOCOL_VERSION_META_KEY]: NAKAFA_MCP_PROTOCOL_VERSION,
          },
        },
      },
      true
    );
    expect(modern.status).toBe(200);
    await expect(
      test.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({ invocationCount: 0 });

    const predecessor = await postMcp(test, initializeBody(2));
    expect(predecessor.status, await predecessor.text()).toBe(200);
    await expect(
      test.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({ invocationCount: 1 });

    await test.mutation(async (ctx) => {
      const row = await ctx.db.query("agentMcpLegacyReads").unique();
      if (!row) {
        throw new Error("Expected the MCP predecessor observation.");
      }
      await ctx.db.patch("agentMcpLegacyReads", row._id, {
        invocationCount: Number.MAX_SAFE_INTEGER,
      });
    });
    const unavailable = await postMcp(test, initializeBody(3));
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toMatchObject({
      error: { code: -32_603 },
      id: 3,
      jsonrpc: "2.0",
    });
  });

  it("seals at the exact boundary and reopens after a late response", async () => {
    vi.useFakeTimers();
    const armedAt = Date.UTC(2026, 7, 26, 8);
    vi.setSystemTime(armedAt);
    const test = createConvexTestWithBetterAuth();
    await test.mutation(arm, { observationId: OBSERVATION_ID });

    vi.setSystemTime(armedAt + MCP_LEGACY_QUIET_WINDOW_MS - 1);
    await expect(
      test.mutation(seal, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "AGENT_MCP_LEGACY_STATE" } });

    const boundary = armedAt + MCP_LEGACY_QUIET_WINDOW_MS;
    vi.setSystemTime(boundary);
    const sealed = await test.mutation(seal, { observationId: OBSERVATION_ID });
    expect(sealed).toMatchObject({ phase: "sealed", sealedAt: boundary });
    await expect(
      test.mutation(seal, { observationId: OBSERVATION_ID })
    ).resolves.toEqual(sealed);

    const lateReadAt = boundary + 1;
    vi.setSystemTime(lateReadAt);
    await expect(test.mutation(record, {})).resolves.toEqual({
      kind: "recorded",
    });
    await expect(
      test.query(status, { observationId: OBSERVATION_ID })
    ).resolves.toMatchObject({
      invocationCount: 1,
      lastInvokedAt: lateReadAt,
      phase: "armed",
      quietSince: lateReadAt,
    });
  });

  it("returns an auditable deletion receipt for sealed evidence", async () => {
    vi.useFakeTimers();
    const armedAt = Date.UTC(2026, 7, 26, 8);
    vi.setSystemTime(armedAt);
    const test = createConvexTestWithBetterAuth();
    await test.mutation(arm, { observationId: OBSERVATION_ID });
    await test.mutation(record, {});

    await expect(
      test.mutation(clear, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "AGENT_MCP_LEGACY_STATE" } });
    vi.setSystemTime(armedAt + MCP_LEGACY_QUIET_WINDOW_MS);
    const sealed = await test.mutation(seal, {
      observationId: OBSERVATION_ID,
    });
    const clearedAt = armedAt + MCP_LEGACY_QUIET_WINDOW_MS + 1;
    vi.setSystemTime(clearedAt);
    await expect(
      test.mutation(clear, { observationId: OBSERVATION_ID })
    ).resolves.toEqual({ ...sealed, clearedAt, deleted: 1 });
    await expect(
      test.query(status, { observationId: OBSERVATION_ID })
    ).rejects.toMatchObject({ data: { code: "AGENT_MCP_LEGACY_STATE" } });
  });

  it("rejects duplicate rows without mutating either record", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation(arm, { observationId: OBSERVATION_ID });
    await test.mutation(async (ctx) => {
      const row = await ctx.db.query("agentMcpLegacyReads").unique();
      if (!row) {
        throw new Error("Expected the MCP predecessor observation.");
      }
      await ctx.db.insert("agentMcpLegacyReads", {
        armedAt: row.armedAt,
        armedDeploymentName: row.armedDeploymentName,
        invocationCount: row.invocationCount,
        observationId: row.observationId,
        phase: row.phase,
        quietSince: row.quietSince,
      });
    });

    await expect(test.mutation(record, {})).rejects.toMatchObject({
      data: { code: "AGENT_MCP_LEGACY_INTEGRITY" },
    });
    await expect(
      test.run((ctx) => ctx.db.query("agentMcpLegacyReads").collect())
    ).resolves.toHaveLength(2);
  });
});
