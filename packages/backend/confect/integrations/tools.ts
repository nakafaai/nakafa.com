import type { GenericId } from "@confect/core";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import {
  mcpToolOutputSchema,
  runMcpTool,
} from "@repo/backend/agent/mcp/result";
import {
  type McpObjectContract,
  toMcpInputSchema,
  toMcpOutputSchema,
} from "@repo/backend/agent/mcp/schema";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import {
  ApiCohort,
  ApiPeriod,
  ApiPerson,
  ApiPlacement,
  PAGE_LIMIT,
  SCHOOL_MCP_PATH,
} from "@repo/backend/confect/integrations/api";
import { pageOr } from "@repo/backend/confect/integrations/reads";
import { PersonStatus } from "@repo/backend/confect/tenancy/schema";
import { NakafaAgentInputError } from "@repo/contents/agent/errors";
import { Context, Effect, Layer, Schema } from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
};

/** The identity a client receives in discovery. */
const SERVER_IDENTITY: McpSchema.Implementation = {
  name: "nakafa-school",
  title: "Nakafa School",
  version: "1.0.0",
};

const SERVER_INSTRUCTIONS =
  "Read the roster of one Nakafa school: its periods, class groups, people, and placements. Every tool is read-only and answers only what the school's Admin opened to this integration client.";

/** One page of a tool's rows and the cursor of the next page, or null on the last page. */
const pageOf = <S extends Schema.Top>(item: S) =>
  Schema.Struct({
    data: Schema.Array(item),
    next: Schema.NullOr(Schema.String),
  });

/** The cursor of the next page, which a first read leaves out. */
const Cursor = Schema.NullOr(Schema.String)
  .pipe(Schema.withDecodingDefaultType(Effect.succeed(null)))
  .annotate({
    default: null,
    description:
      "The `next` cursor of the previous page; leave it out for the first page.",
  });

/** The input of a paged read of one period. */
const PeriodPage = Schema.Struct({
  cursor: Cursor,
  period: Schema.String.annotate({
    description: "The id of the period, from school_list_periods.",
  }),
});

/** The input of the people read. */
const PeoplePage = Schema.Struct({
  cursor: Cursor,
  status: PersonStatus.pipe(
    Schema.withDecodingDefaultType(Effect.succeed("active"))
  ).annotate({
    default: "active",
    description: "The status of the people to list.",
  }),
});

/** The input of a read that takes nothing. */
const NoInput = Schema.Struct({});

/** The tool error of a read that the client's action list or scope does not open. */
const forbidden = new NakafaAgentInputError({
  cause: "The client's action list or scope does not open this read.",
  message:
    "Ask the school's Admin to open this read to the integration client.",
});

/** One read-only tool definition from its text and its contracts. */
const readOnlyTool = Effect.fn("integrations.tools.tool")(function* (options: {
  readonly description: string;
  readonly input: McpObjectContract;
  readonly name: string;
  readonly output: McpObjectContract;
  readonly title: string;
}) {
  return new McpSchema.Tool({
    annotations: READ_ONLY,
    description: options.description,
    inputSchema: yield* toMcpInputSchema(options.input),
    name: options.name,
    outputSchema: yield* toMcpOutputSchema(options.output),
    title: options.title,
  });
}, Effect.orDie);

/**
 * Registers the school's tools for one verified client (ADR 0029). Each tool is one of the
 * roster reads the REST API serves, run by the same internal query for that client, so no
 * tool reads more than the client's action list and scope open.
 */
const registerSchoolTools = Effect.fn("integrations.tools.register")(
  function* (options: {
    readonly clientId: GenericId.GenericId<"integrationClients">;
    readonly requestId: string;
    readonly services: Context.Context<QueryRunner>;
  }) {
    const { clientId, requestId, services } = options;
    const server = yield* McpServer.McpServer;
    const run = <A extends Readonly<Record<string, unknown>>>(
      program: Effect.Effect<A, NakafaAgentInputError, QueryRunner>
    ) => runMcpTool(program.pipe(Effect.provideContext(services)), requestId);
    const reads = refs.internal.integrations.reads;

    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            yield* decodeAgentInput(
              NoInput,
              input,
              "This tool takes no input."
            );
            const { runQuery } = yield* QueryRunner;
            const answer = yield* runQuery(reads.periods, { clientId }).pipe(
              Effect.orDie
            );
            return yield* pageOr(answer, () => forbidden);
          })
        ),
      tool: yield* readOnlyTool({
        description:
          "List the periods (semesters or school years) of the school.",
        input: NoInput,
        name: "school_list_periods",
        output: mcpToolOutputSchema(pageOf(ApiPeriod)),
        title: "List periods",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            const { cursor, period } = yield* decodeAgentInput(
              PeriodPage,
              input,
              "Send the period's id, and the cursor of the next page if any."
            );
            const { runQuery } = yield* QueryRunner;
            const answer = yield* runQuery(reads.cohorts, {
              clientId,
              cursor,
              numItems: PAGE_LIMIT,
              period,
            }).pipe(Effect.orDie);
            return yield* pageOr(answer, () => forbidden);
          })
        ),
      tool: yield* readOnlyTool({
        description:
          "List the class groups (rombel) of one period, a page at a time.",
        input: PeriodPage,
        name: "school_list_cohorts",
        output: mcpToolOutputSchema(pageOf(ApiCohort)),
        title: "List class groups",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            const { cursor, status } = yield* decodeAgentInput(
              PeoplePage,
              input,
              "Send a status, and the cursor of the next page if any."
            );
            const { runQuery } = yield* QueryRunner;
            const answer = yield* runQuery(reads.people, {
              clientId,
              cursor,
              numItems: PAGE_LIMIT,
              status,
            }).pipe(Effect.orDie);
            return yield* pageOr(answer, () => forbidden);
          })
        ),
      tool: yield* readOnlyTool({
        description:
          "List the people of the school by status, a page at a time, with no email address.",
        input: PeoplePage,
        name: "school_list_people",
        output: mcpToolOutputSchema(pageOf(ApiPerson)),
        title: "List people",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            const { cursor, period } = yield* decodeAgentInput(
              PeriodPage,
              input,
              "Send the period's id, and the cursor of the next page if any."
            );
            const { runQuery } = yield* QueryRunner;
            const answer = yield* runQuery(reads.placements, {
              clientId,
              cursor,
              numItems: PAGE_LIMIT,
              period,
            }).pipe(Effect.orDie);
            return yield* pageOr(answer, () => forbidden);
          })
        ),
      tool: yield* readOnlyTool({
        description:
          "List which student is placed in which class group of one period, a page at a time.",
        input: PeriodPage,
        name: "school_list_placements",
        output: mcpToolOutputSchema(pageOf(ApiPlacement)),
        title: "List placements",
      }),
    });
  }
);

/** The school MCP engine of one request: Effect's Streamable HTTP server with the school's tools. */
export function schoolMcpEngine(options: {
  readonly allowedOrigins: readonly string[];
  readonly clientId: GenericId.GenericId<"integrationClients">;
  readonly requestId: string;
  readonly services: Context.Context<QueryRunner>;
}) {
  return Layer.effectDiscard(registerSchoolTools(options)).pipe(
    Layer.provide(
      McpServer.layerHttp({
        ...SERVER_IDENTITY,
        allowedOrigins: options.allowedOrigins,
        instructions: SERVER_INSTRUCTIONS,
        path: SCHOOL_MCP_PATH,
        protocols: [McpProtocol.v2026_07_28],
      })
    )
  );
}
