// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { SCHOOL_MCP_PATH } from "@repo/backend/confect/integrations/api";
import { createClient, type Fixture, issue } from "@repo/backend/test/api";
import { period } from "@repo/backend/test/classroom";
import {
  type McpRequest,
  modernPost,
  withHeaders,
} from "@repo/backend/test/mcp/harness";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** A Retry-After value in whole seconds. */
const SECONDS = /^\d+$/;

/** The MCP server of the school `nf`, as a token request names it (RFC 8707). */
const MCP_RESOURCE = "https://nf.nakafa.com/mcp";

/** Sends one MCP request to the school MCP route with a bearer token, or none. */
const send = (fixture: Fixture, request: McpRequest, token?: string) => {
  const headers = new Headers();
  for (const [name, value] of Rec.toEntries(request.headers ?? {})) {
    if (value !== null) {
      headers.set(name, value);
    }
  }
  if (token !== undefined) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return Effect.promise(() =>
    fixture.fetch(SCHOOL_MCP_PATH, {
      ...(request.body === undefined ? {} : { body: request.body }),
      headers,
      method: request.method,
    })
  );
};

/** The JSON body of an answer. */
const json = (response: Response) =>
  Effect.promise(() => response.text()).pipe(
    Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown)))
  );

/** A token for the school's MCP server, from a client with the given reads. */
const mcpToken = Effect.fn("test.integrations.mcpToken")(function* (
  fixture: Fixture,
  actions?: Parameters<typeof createClient>[1]
) {
  const client = yield* createClient(fixture, actions);
  const issued = yield* issue(fixture, client, MCP_RESOURCE);
  return { client, token: issued.outcome === "issued" ? issued.token : "" };
});

/** The tools of a tools/list answer, with the hint every client reads. */
const ToolList = Schema.Struct({
  result: Schema.Struct({
    tools: Schema.Array(
      Schema.Struct({
        annotations: Schema.Struct({ readOnlyHint: Schema.Boolean }),
        name: Schema.String,
      })
    ),
  }),
});

/** The structured content of a tool call's answer. */
const ToolAnswer = Schema.Struct({
  result: Schema.Struct({
    isError: Schema.optionalKey(Schema.Boolean),
    structuredContent: Schema.Unknown,
  }),
});

describe("school MCP route", () => {
  it.effect(
    "lists the school's four read-only tools to a client with an MCP token",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { token } = yield* mcpToken(fixture);
        const answer = yield* send(fixture, modernPost(1, "tools/list"), token);
        expect(answer.status).toBe(200);
        const body = yield* json(answer);
        const list = yield* Schema.decodeUnknownEffect(ToolList)(body);
        expect(
          Arr.map(
            list.result.tools,
            (tool) => `${tool.name}:${tool.annotations.readOnlyHint}`
          )
        ).toEqual([
          "school_list_periods:true",
          "school_list_cohorts:true",
          "school_list_people:true",
          "school_list_placements:true",
        ]);
        const discovered = yield* json(
          yield* send(fixture, modernPost(2, "server/discover"), token)
        );
        expect(discovered).toMatchObject({
          result: { capabilities: { tools: {} } },
        });
        expect(discovered).not.toMatchObject({
          result: { capabilities: { prompts: {} } },
        });
      })
  );

  it.effect(
    "reads the roster through a tool, and answers a closed read and a wrong input as tool errors",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const { token } = yield* mcpToken(fixture);
        const call = (
          id: number,
          name: string,
          args: Readonly<Record<string, unknown>>
        ) =>
          send(
            fixture,
            modernPost(id, "tools/call", { arguments: args, name }, name),
            token
          ).pipe(
            Effect.flatMap(json),
            Effect.flatMap(Schema.decodeUnknownEffect(ToolAnswer))
          );
        const periods = yield* call(1, "school_list_periods", {});
        expect(periods.result.isError).not.toBe(true);
        expect(periods.result.structuredContent).toMatchObject({
          data: [{ id: term.id }],
          next: null,
        });
        for (const [name, args] of [
          ["school_list_cohorts", { period: term.id }],
          ["school_list_people", { status: "active" }],
          ["school_list_placements", { cursor: null, period: term.id }],
        ] as const) {
          expect((yield* call(3, name, args)).result.isError).not.toBe(true);
        }
        expect(
          (yield* call(4, "school_list_people", {})).result.isError
        ).not.toBe(true);
        expect((yield* call(5, "school_list_cohorts", {})).result.isError).toBe(
          true
        );
        expect(
          (yield* call(6, "school_list_people", { status: "graduated" })).result
            .isError
        ).toBe(true);

        // A client that holds only cohort.view reads no period and no person, so each tool refuses it.
        const closed = yield* mcpToken(fixture, ["cohort.view"]);
        for (const [name, args] of [
          ["school_list_periods", {}],
          ["school_list_cohorts", { period: term.id }],
          ["school_list_people", {}],
          ["school_list_placements", { period: term.id }],
        ] as const) {
          const refused = yield* send(
            fixture,
            modernPost(7, "tools/call", { arguments: args, name }, name),
            closed.token
          ).pipe(
            Effect.flatMap(json),
            Effect.flatMap(Schema.decodeUnknownEffect(ToolAnswer))
          );
          expect(refused.result.isError).toBe(true);
        }
      })
  );

  it.effect(
    "refuses a missing token, an API token, and a client past its limit",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const request = modernPost(1, "tools/list");
        const missing = yield* send(fixture, request);
        expect(missing.status).toBe(401);
        expect(missing.headers.get("www-authenticate")).toBe(
          'Bearer realm="nakafa-school"'
        );
        expect(
          (yield* send(
            fixture,
            withHeaders(request, { authorization: "Basic x" })
          )).status
        ).toBe(401);
        const client = yield* createClient(fixture);
        const api = yield* issue(fixture, client);
        expect(
          (yield* send(
            fixture,
            request,
            api.outcome === "issued" ? api.token : ""
          )).status
        ).toBe(401);

        const { token } = yield* mcpToken(fixture);
        for (const _ of Arr.makeBy(600, (index) => index)) {
          yield* fixture.internal.mutation(
            refs.internal.integrations.tokens.check,
            {
              resource: "mcp",
              token,
            }
          );
        }
        const limited = yield* send(fixture, request, token);
        expect(limited.status).toBe(429);
        expect(limited.headers.get("retry-after")).toMatch(SECONDS);
      })
  );

  it.effect("keeps the transport rules of the Nakafa MCP server", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const { token } = yield* mcpToken(fixture);
      const list = modernPost(1, "tools/list");
      expect(
        (yield* send(fixture, { headers: {}, method: "OPTIONS" }, token)).status
      ).toBe(204);
      expect(
        (yield* send(fixture, { headers: {}, method: "GET" }, token)).status
      ).toBe(405);
      expect(
        (yield* send(
          fixture,
          withHeaders(list, { "mcp-protocol-version": null }),
          token
        )).status
      ).toBe(400);
      expect(
        (yield* send(fixture, { ...list, body: "x".repeat(70_000) }, token))
          .status
      ).toBe(413);
      expect(
        (yield* send(
          fixture,
          withHeaders(list, { "content-length": "many" }),
          token
        )).status
      ).toBe(400);
      const notification = {
        ...list,
        body: '{"jsonrpc":"2.0","method":"notifications/initialized"}',
      };
      expect((yield* send(fixture, notification, token)).status).toBe(202);
      expect(
        (yield* send(fixture, modernPost(2, "logging/setLevel"), token)).status
      ).toBe(404);
    })
  );
});
