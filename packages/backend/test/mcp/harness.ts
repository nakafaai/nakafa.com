import { RateLimiter } from "@convex-dev/rate-limiter";
import { expect } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { seedArticle, seedQuran } from "@repo/backend/test/mcp/seed";
import { encodeJsonText, JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Record, Schema } from "effect";

type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Wire literals a client or the Vercel bridge sends or receives. */
const MCP_PATH = "/internal/mcp";
export const MCP_SECRET_HEADER = "x-nakafa-mcp-edge-secret";
export const MCP_SECRET_ENVIRONMENT = "NAKAFA_MCP_EDGE_SECRET";
export const MCP_SECRET = "technical-mcp-edge-secret";
const MCP_PROTOCOL_VERSION = "2026-07-28";
export const MCP_CLIENT_META = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "nakafa-test-client",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
} as const;

/** Fixed per-request identity: every echo of the request ID is this value. */
const GOLDEN_REQUEST_ID = "golden-request";
/** Fixed rate-limit identity for every request that does not replace it. */
const GOLDEN_CLIENT_ADDRESS = "203.0.113.21";
/** Clock for the public-read token bucket. A frozen clock never refills the bucket, so its budget is exact on every run. */
const GOLDEN_NOW = 1_800_000_000_000;

/** Headers the runtime adds on its own, which the golden contract does not pin. */
const UNPINNED_HEADERS = ["content-length", "date"];

/** Headers every golden request carries unless a case replaces or removes one. */
const DEFAULT_HEADERS: Readonly<Record<string, string | null>> = {
  [MCP_SECRET_HEADER]: MCP_SECRET,
  "x-forwarded-for": GOLDEN_CLIENT_ADDRESS,
  "x-request-id": GOLDEN_REQUEST_ID,
};

const encodeJson = encodeJsonText;
const decodeJson = Schema.decodeUnknownEffect(JsonTextSchema);

/** One request as a client sends it. A header set to null is left out. */
const McpRequestSchema = Schema.Struct({
  body: Schema.optional(Schema.String),
  headers: Schema.optional(
    Schema.Record(Schema.String, Schema.NullOr(Schema.String))
  ),
  method: Schema.String,
});
export type McpRequest = typeof McpRequestSchema.Type;

/** The body as JSON when it is a JSON document, otherwise as exact text. */
const McpBodySchema = Schema.Union([
  Schema.Struct({ json: Schema.Unknown }),
  Schema.Struct({ text: Schema.String }),
]);
type McpBody = typeof McpBodySchema.Type;

/** The complete observable answer: status, every pinned header, and the body. */
const McpAnswerSchema = Schema.Struct({
  body: McpBodySchema,
  headers: Schema.Record(Schema.String, Schema.String),
  status: Schema.Int,
});

/** The deployment state a case arranges before its request is sent. */
const McpArrangementSchema = Schema.Literals([
  "article",
  "empty",
  "limiter-down",
  "public-read-spent",
  "quran",
]);
type McpArrangement = typeof McpArrangementSchema.Type;

/** One golden case: a behavior name, the request, the arranged state, and the exact answer. */
const McpCaseSchema = Schema.Struct({
  answer: McpAnswerSchema,
  arrangement: Schema.optional(McpArrangementSchema),
  name: Schema.String,
  request: McpRequestSchema,
});
export type McpCase = typeof McpCaseSchema.Type;

/** Builds one modern JSON-RPC POST that carries its method and protocol headers. */
export function modernPost(
  id: number,
  method: string,
  params: Readonly<Record<string, unknown>> = {},
  name?: string
): McpRequest {
  return {
    body: encodeJson({
      id,
      jsonrpc: "2.0",
      method,
      params: { ...params, _meta: MCP_CLIENT_META },
    }),
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      ...(name === undefined ? {} : { "mcp-name": name }),
    },
    method: "POST",
  };
}

/** Returns the same request with the given headers replaced or removed (null removes). */
export function withHeaders(
  request: McpRequest,
  headers: Readonly<Record<string, string | null>>
): McpRequest {
  return { ...request, headers: { ...request.headers, ...headers } };
}

/** Encodes one JSON-RPC value as the exact body text a client sends. */
export function jsonBody(value: unknown): string {
  return encodeJson(value);
}

/** Sends one request through the real Convex router and the edge guard. */
export function sendMcpRequest(
  test: BackendTest,
  request: McpRequest
): Promise<Response> {
  const headers = new Headers();
  for (const [name, value] of Record.toEntries({
    ...DEFAULT_HEADERS,
    ...request.headers,
  })) {
    if (value !== null) {
      headers.set(name, value);
    }
  }
  return test.fetch(MCP_PATH, {
    ...(request.body === undefined ? {} : { body: request.body }),
    headers,
    method: request.method,
  });
}

/** Freezes Date for the public-read bucket. The setup file restores real timers after each test. */
function pinMcpClock() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(GOLDEN_NOW);
}

/**
 * Spends the public-read bucket of 30 tokens: 29 allowed discovery reads, then
 * one oversized request that is charged before its body is read.
 */
const spendPublicRead = (test: BackendTest) =>
  Effect.gen(function* () {
    pinMcpClock();
    const allowed = yield* Effect.all(
      Arr.makeBy(29, (index) =>
        Effect.promise(() =>
          sendMcpRequest(test, modernPost(100 + index, "server/discover"))
        )
      ),
      { concurrency: "unbounded" }
    );
    const oversized = yield* Effect.promise(() =>
      sendMcpRequest(test, {
        headers: {
          "content-length": "65537",
          "content-type": "application/json",
        },
        method: "POST",
      })
    );
    expect(Arr.map(allowed, ({ status }) => status)).toEqual(
      Arr.makeBy(29, () => 200)
    );
    expect(oversized.status).toBe(413);
  });

/** Makes the rate-limit component fail on its next call, the outage the route answers with 503. */
const limiterDown = () =>
  Effect.sync(() => {
    vi.spyOn(RateLimiter.prototype, "limit").mockRejectedValueOnce(
      new Error("quota unavailable")
    );
  });

const ARRANGEMENTS: Record<
  McpArrangement,
  (test: BackendTest) => Effect.Effect<void>
> = {
  article: (test) => Effect.promise(() => seedArticle(test)),
  empty: () => Effect.void,
  "limiter-down": limiterDown,
  "public-read-spent": spendPublicRead,
  quran: (test) => Effect.promise(() => seedQuran(test)),
};

/** Runs one case against a fresh deployment and returns the raw response. */
export const sendMcpCase = Effect.fn("TestMcp.sendCase")(function* (
  testCase: McpCase
) {
  const test = createConvexTestWithBetterAuth();
  yield* ARRANGEMENTS[testCase.arrangement ?? "empty"](test);
  return yield* Effect.promise(() => sendMcpRequest(test, testCase.request));
});

/** Reads the complete answer, decoding the body in the shape the case expects. */
export const readMcpAnswer = Effect.fn("TestMcp.readAnswer")(function* (
  response: Response,
  expected: McpBody
) {
  const text = yield* Effect.promise(() => response.text());
  const body =
    "json" in expected ? { json: yield* decodeJson(text) } : { text };
  return {
    body,
    headers: pinnedHeaders(response.headers),
    status: response.status,
  };
});

/** Keeps every response header except the ones the runtime adds by itself. */
function pinnedHeaders(headers: Headers) {
  return Record.fromEntries(
    Arr.filter(
      Arr.fromIterable(headers),
      ([name]) => !Arr.contains(UNPINNED_HEADERS, name)
    )
  );
}
