import {
  jsonBody,
  type McpCase,
  modernPost,
} from "@repo/backend/test/mcp/harness";
import { BODYLESS_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Limits: the body ceiling, the public-read budget, an unavailable client identity, and an outage of the rate limiter. */
export const LIMIT_CASES: readonly McpCase[] = [
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 413,
    },
    name: "a declared body length above the ceiling is refused before the body is read",
    request: {
      headers: {
        "content-length": "65537",
        "content-type": "application/json",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 413,
    },
    name: "a streamed body that grows above the ceiling is refused without a JSON-RPC answer",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        padding: "x".repeat(65_537),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: {
        ...BODYLESS_RESPONSE_HEADERS,
        "retry-after": "1",
      },
      status: 429,
    },
    arrangement: "public-read-spent",
    name: "a caller past its public-read budget is refused with a retry delay and no body",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 503,
    },
    name: "a request whose client identity is unavailable is refused without a body",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 503,
    },
    arrangement: "limiter-down",
    name: "a request whose rate-limit component fails is refused without a body",
    request: modernPost(120, "server/discover"),
  },
];
