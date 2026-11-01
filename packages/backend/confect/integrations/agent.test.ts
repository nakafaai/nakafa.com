// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { SCHOOL_MCP_PATH } from "@repo/backend/confect/integrations/api";
import type { Fixture } from "@repo/backend/test/api";
import { type McpRequest, modernPost } from "@repo/backend/test/mcp/harness";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";

/** The one stand-in for Convex's HTTP API in this file. */
const fetcher = vi.fn<typeof fetch>();

/** A bearer token in the shape of a Convex token. The test backend verifies the identity itself. */
const TOKEN = "header.payload.signature";

const CLOUD_URL = "https://nakafa.convex.cloud";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("CONVEX_CLOUD_URL", CLOUD_URL);
});

const ToolList = Schema.Struct({
  result: Schema.Struct({
    tools: Schema.Array(Schema.Struct({ name: Schema.String })),
  }),
});

const ToolAnswer = Schema.Struct({
  result: Schema.Struct({
    isError: Schema.optionalKey(Schema.Boolean),
    structuredContent: Schema.Unknown,
  }),
});

/** Sends one MCP request as the school's admin, with their verified token. */
const send = (fixture: Fixture, request: McpRequest) => {
  const headers = new Headers({ authorization: `Bearer ${TOKEN}` });
  for (const [name, value] of Rec.toEntries(request.headers ?? {})) {
    if (value !== null) {
      headers.set(name, value);
    }
  }
  return Effect.promise(() =>
    fixture.fetchAs("admin", SCHOOL_MCP_PATH, {
      ...(request.body === undefined ? {} : { body: request.body }),
      headers,
      method: request.method,
    })
  );
};

/** The JSON body of an answer. */
const jsonOf = (response: Response) =>
  Effect.promise(() => response.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown)))
  );

/** Calls one tool as the school's admin. */
const call = (
  fixture: Fixture,
  name: string,
  args: Readonly<Record<string, unknown>>
) =>
  send(
    fixture,
    modernPost(1, "tools/call", { arguments: args, name }, name)
  ).pipe(
    Effect.flatMap(jsonOf),
    Effect.flatMap(Schema.decodeUnknownEffect(ToolAnswer))
  );

describe("the agent tools of a signed-in person", () => {
  it.effect("offers three tools in place of a client's", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const answer = yield* send(fixture, modernPost(1, "tools/list"));
      const list = yield* jsonOf(answer).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(ToolList))
      );
      expect(Arr.map(list.result.tools, (tool) => tool.name)).toEqual([
        "nakafa_list_functions",
        "nakafa_describe_function",
        "nakafa_call_function",
      ]);
    })
  );

  it.effect("finds public functions only, and reads their arguments", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const areas = yield* call(fixture, "nakafa_list_functions", {});
      expect(areas.result.structuredContent).toMatchObject({
        areas: expect.arrayContaining(["exams", "tenancy", "tryouts"]),
        functions: [],
      });
      const listed = yield* call(fixture, "nakafa_list_functions", {
        area: "integrations",
      });
      const names = encodeJsonText(listed.result.structuredContent);
      expect(names).toContain("integrations/clients:create");
      // `tokens` holds internal functions only, so an agent never sees them.
      expect(names).not.toContain("integrations/tokens:");
      const described = yield* call(fixture, "nakafa_describe_function", {
        name: "tenancy/people:list",
      });
      expect(described.result.structuredContent).toMatchObject({
        kind: "query",
        name: "tenancy/people:list",
      });
      const unknown = yield* call(fixture, "nakafa_describe_function", {
        name: "tenancy/people:none",
      });
      expect(unknown.result.isError).toBe(true);
    })
  );

  it.effect(
    "runs a function with the person's own token, and passes on its answer",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        fetcher.mockResolvedValueOnce(
          Response.json({ status: "success", value: { page: [] } })
        );
        const answer = yield* call(fixture, "nakafa_call_function", {
          args: { slug: "nf" },
          name: "tenancy/people:list",
        });
        expect(answer.result.structuredContent).toEqual({
          value: { page: [] },
        });
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(String(url)).toBe(`${CLOUD_URL}/api/run/tenancy/people/list`);
        expect(new Headers(init?.headers).get("authorization")).toBe(
          `Bearer ${TOKEN}`
        );
        expect(String(init?.body)).toBe(
          '{"args":{"slug":"nf"},"format":"json"}'
        );
      })
  );

  it.effect("reports a function's refusal and a call with no answer", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      fetcher.mockResolvedValueOnce(
        Response.json({ errorMessage: "Forbidden", status: "error" })
      );
      const refused = yield* call(fixture, "nakafa_call_function", {
        args: {},
        name: "tenancy/people:list",
      });
      expect(refused.result.isError).toBe(true);
      expect(encodeJsonText(refused.result.structuredContent)).toContain(
        "Forbidden"
      );
      fetcher.mockResolvedValueOnce(new Response("not json"));
      const broken = yield* call(fixture, "nakafa_call_function", {
        args: {},
        name: "tenancy/people:list",
      });
      expect(broken.result.isError).toBe(true);
    })
  );

  it.effect("refuses a signed token that names no identity", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const request = modernPost(1, "tools/list");
      const refused = yield* Effect.promise(() =>
        fixture.fetch(SCHOOL_MCP_PATH, {
          ...(request.body === undefined ? {} : { body: request.body }),
          headers: { authorization: `Bearer ${TOKEN}` },
          method: request.method,
        })
      );
      expect(refused.status).toBe(401);
    })
  );
});
