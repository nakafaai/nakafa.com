// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { CONTENT_CALL_CASES } from "@repo/backend/test/mcp/calls/content";
import { QURAN_CALL_CASES } from "@repo/backend/test/mcp/calls/quran";
import { SEARCH_CALL_CASES } from "@repo/backend/test/mcp/calls/search";
import { TAXONOMY_CALL_CASES } from "@repo/backend/test/mcp/calls/taxonomy";
import { DISCOVERY_CASES } from "@repo/backend/test/mcp/discovery";
import {
  MCP_SECRET,
  MCP_SECRET_ENVIRONMENT,
  type McpCase,
  type McpRequest,
  readMcpAnswer,
  sendMcpCase,
  sendMcpRequest,
} from "@repo/backend/test/mcp/harness";
import { HTTP_CASES } from "@repo/backend/test/mcp/http";
import { INVALID_TOOL_CALL_CASES } from "@repo/backend/test/mcp/invalid";
import { JSON_RPC_CASES } from "@repo/backend/test/mcp/jsonrpc";
import { LIMIT_CASES } from "@repo/backend/test/mcp/limits";
import { PROMPT_CASES } from "@repo/backend/test/mcp/prompts";
import { PROTOCOL_CASES } from "@repo/backend/test/mcp/protocol";
import { REFUSED_TOOL_CALL_CASES } from "@repo/backend/test/mcp/refusals";
import { RESOURCE_CASES } from "@repo/backend/test/mcp/resources";
import { Effect } from "effect";

type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;
const text = (response: Response) => Effect.promise(() => response.text());
function send(test: BackendTest, request: McpRequest) {
  return Effect.promise(() => sendMcpRequest(test, request));
}
beforeEach(() => {
  vi.stubEnv(MCP_SECRET_ENVIRONMENT, MCP_SECRET);
  // The origin cases were recorded with no allowlist configured.
  vi.stubEnv("NAKAFA_MCP_ALLOWED_ORIGINS", undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
/** Sends one golden case and compares its complete answer with the pinned one. */
const runGoldenCase = Effect.fn("TestMcp.runGoldenCase")(function* (
  testCase: McpCase
) {
  const response = yield* sendMcpCase(testCase);
  const answer = yield* readMcpAnswer(response, testCase.answer.body);
  expect(answer).toStrictEqual(testCase.answer);
});
describe("Nakafa MCP golden contract", () => {
  describe("discovery and lists", () => {
    it.effect.each(DISCOVERY_CASES)("$name", runGoldenCase);
  });
  describe("tool calls", () => {
    it.effect.each(SEARCH_CALL_CASES)("$name", runGoldenCase);
    it.effect.each(CONTENT_CALL_CASES)("$name", runGoldenCase);
    it.effect.each(TAXONOMY_CALL_CASES)("$name", runGoldenCase);
    it.effect.each(QURAN_CALL_CASES)("$name", runGoldenCase);
    it.effect.each(INVALID_TOOL_CALL_CASES)("$name", runGoldenCase);
    it.effect.each(REFUSED_TOOL_CALL_CASES)("$name", runGoldenCase);
  });
  describe("prompts", () => {
    it.effect.each(PROMPT_CASES)("$name", runGoldenCase);
  });
  describe("resources", () => {
    it.effect.each(RESOURCE_CASES)("$name", runGoldenCase);
  });
  describe("protocol headers", () => {
    it.effect.each(PROTOCOL_CASES)("$name", runGoldenCase);
  });
  describe("JSON-RPC shape", () => {
    it.effect.each(JSON_RPC_CASES)("$name", runGoldenCase);
  });
  describe("HTTP shape", () => {
    it.effect.each(HTTP_CASES)("$name", runGoldenCase);
  });
  describe("limits", () => {
    it.effect.each(LIMIT_CASES)("$name", runGoldenCase);
  });
});
describe("Nakafa MCP transport", () => {
  it.effect("rejects mismatched body framing before the protocol engine", () =>
    Effect.gen(function* () {
      const response = yield* send(createConvexTestWithBetterAuth(), {
        body: "{}",
        headers: { "content-length": "1", "content-type": "application/json" },
        method: "POST",
      });
      expect(response.status).toBe(400);
      expect(yield* text(response)).toBe("");
    })
  );
});
