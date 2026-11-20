// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ApiGradeDraft,
  SCHOOL_MCP_PATH,
} from "@repo/backend/confect/integrations/api";
import type { Fixture } from "@repo/backend/test/api";
import { createClient, issue } from "@repo/backend/test/api";
import { forumClass, nf, period } from "@repo/backend/test/classroom";
import { asStaffSchool } from "@repo/backend/test/guardians";
import type { McpRequest } from "@repo/backend/test/mcp/harness";
import { modernPost, withHeaders } from "@repo/backend/test/mcp/harness";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Record as Rec, Schema } from "effect";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** The actions of a client that writes the roster and grades and reads them back. */
const WRITES = [
  "grade.export",
  "grade.import",
  "period.view",
  "roster.import",
] as const;

/** One student of a roster import. */
const STUDENT = {
  name: "Raka Pratama",
  nisn: "0012345678",
  underAgeLimit: true,
};

/** A Retry-After value in whole seconds. */
const SECONDS = /^\d+$/u;

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

/** Calls one school tool with a token, and decodes its answer. */
const callTool =
  (fixture: Fixture, token: string) =>
  (id: number, name: string, args: Readonly<Record<string, unknown>>) =>
    send(
      fixture,
      modernPost(id, "tools/call", { arguments: args, name }, name),
      token
    ).pipe(
      Effect.flatMap(json),
      Effect.flatMap(Schema.decodeUnknownEffect(ToolAnswer))
    );

describe("school MCP route", () => {
  it.effect(
    "lists the school's read-only tools to a client with an MCP token",
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
          "school_list_grades:true",
          "school_import_roster:false",
          "school_enter_grade:false",
          "school_list_changes:true",
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
        const call = callTool(fixture, token);
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
          const refused = yield* callTool(fixture, closed.token)(7, name, args);
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

  it.effect(
    "imports students and enters grades through tools, lists grades and changes, and answers each refusal as a tool error",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const term = yield* period(fixture, fixture.units.smp);
        const { classId } = yield* forumClass(fixture, term.id, "X-1");
        const { token } = yield* mcpToken(fixture, WRITES);
        const call = callTool(fixture, token);
        const failed = (answer: typeof ToolAnswer.Type) =>
          answer.result.isError === true;
        const roster = { key: "k1", period: term.id, rows: [STUDENT] };
        const entry = {
          classId,
          personId: fixture.people.student.personId,
          value: 88,
        };

        const imported = yield* call(1, "school_import_roster", roster);
        expect(imported.result.structuredContent).toEqual({
          added: 1,
          changed: 0,
          skipped: 0,
        });
        const reused = { ...roster, rows: [] };
        expect(failed(yield* call(2, "school_import_roster", reused))).toBe(
          true
        );
        const invalid = {
          ...roster,
          key: "k2",
          rows: [{ ...STUDENT, nisn: "1" }],
        };
        expect(failed(yield* call(3, "school_import_roster", invalid))).toBe(
          true
        );

        const entered = yield* call(4, "school_enter_grade", entry);
        const draft = yield* Schema.decodeUnknownEffect(ApiGradeDraft)(
          entered.result.structuredContent
        );
        expect(draft.value).toBe(88);
        const { personId: teacher } = fixture.people.teacher;
        const outside = { ...entry, personId: teacher };
        expect(failed(yield* call(5, "school_enter_grade", outside))).toBe(
          true
        );
        const gradeId = yield* Schema.decodeUnknownEffect(Id("classGrades"))(
          draft.id
        );
        yield* fixture
          .as("teacher")
          .mutation(refs.public.records.grades.release, {
            gradeId,
            slug: nf,
          });
        expect(failed(yield* call(6, "school_enter_grade", entry))).toBe(true);
        const grades = { period: term.id };
        expect(failed(yield* call(7, "school_list_grades", grades))).toBe(
          false
        );
        expect(failed(yield* call(8, "school_list_changes", {}))).toBe(false);

        // A client that holds only period.view writes nothing and reads no grade.
        const closed = callTool(
          fixture,
          (yield* mcpToken(fixture, ["period.view"])).token
        );
        for (const [name, args] of [
          ["school_import_roster", { ...roster, key: "k3" }],
          ["school_enter_grade", entry],
          ["school_list_grades", grades],
        ] as const) {
          expect(failed(yield* closed(9, name, args))).toBe(true);
        }
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
