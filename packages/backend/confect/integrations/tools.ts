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
import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  ApiChange,
  ApiCohort,
  ApiGrade,
  ApiGradeDraft,
  ApiGradeEntry,
  ApiImportSummary,
  ApiPeriod,
  ApiPerson,
  ApiPlacement,
  ApiRosterImport,
  PAGE_LIMIT,
  SCHOOL_MCP_PATH,
} from "@repo/backend/confect/integrations/api";
import { pageOr } from "@repo/backend/confect/integrations/reads";
import { ImportRow } from "@repo/backend/confect/roster/schema";
import { PersonStatus } from "@repo/backend/confect/tenancy/schema";
import { NakafaAgentInputError } from "@repo/contents/agent/errors";
import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import { Context, Effect, Layer, Match, Schema } from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
};

/** The roster import writes, and a repeat of its key writes nothing. */
const IMPORT = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: false,
};

/** The identity a client receives in discovery. */
const SERVER_IDENTITY: McpSchema.Implementation = {
  name: "nakafa-school",
  title: "Nakafa School",
  version: "1.0.0",
};

const SERVER_INSTRUCTIONS =
  "Read one Nakafa school: its periods, class groups, people, placements, released grades, and published changes, and import students into a period. Every tool answers only what the school's Admin opened to this integration client.";

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

/** The input of the changes read. */
const ChangesPage = Schema.Struct({ cursor: Cursor });

/** The input of the roster import: the students, and the key that makes a retry safe. */
const RosterImport = ApiRosterImport.mapFields((fields) => ({
  ...fields,
  key: Schema.String.annotate({
    description:
      "A key of your own for this request. Repeating it repeats the answer and writes nothing.",
  }),
}));

/** The input of a grade entry. */
const GradeEntry = ApiGradeEntry.mapFields((fields) => ({
  classId: fields.classId.annotate({ description: "The id of the class." }),
  personId: fields.personId.annotate({
    description: "The id of the student, from school_list_people.",
  }),
  value: fields.value.annotate({ description: "The grade, from 0 to 100." }),
}));

/** The input of a read that takes nothing. */
const NoInput = Schema.Struct({});

/** The tool error of a read that the client's action list or scope does not open. */
const forbidden = new NakafaAgentInputError({
  cause: "The client's action list or scope does not open this read.",
  message:
    "Ask the school's Admin to open this read to the integration client.",
});

/** The tool error of a request whose rows do not read as students. */
const invalidRows = new NakafaAgentInputError({
  cause: "A row does not read as a student.",
  message: "Send a name and a ten-digit NISN for each student.",
});

/** The tool error of a key that was used for another request. */
const keyConflict = new NakafaAgentInputError({
  cause: "This key was used for another request.",
  message: "Send a new key for a new request.",
});

/** The tool error of a grade for a student who is not in the class. */
const notPlaced = new NakafaAgentInputError({
  cause: "This student is not in this class.",
  message: "Send a student placed in the class's group.",
});

/** The tool error of a grade that a teacher already released. */
const alreadyReleased = new NakafaAgentInputError({
  cause: "This grade is already released.",
  message: "A released grade stays as it is.",
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
    readonly services: Context.Context<MutationRunner | QueryRunner>;
  }) {
    const { clientId, requestId, services } = options;
    const server = yield* McpServer.McpServer;
    const run = <A extends Readonly<Record<string, unknown>>>(
      program: Effect.Effect<
        A,
        NakafaAgentInputError,
        MutationRunner | QueryRunner
      >
    ) => runMcpTool(program.pipe(Effect.provideContext(services)), requestId);
    const reads = integrationsInternal.reads;

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
        output: ApiPeriod.pipe(pageOf, mcpToolOutputSchema),
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
        output: ApiCohort.pipe(pageOf, mcpToolOutputSchema),
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
        output: ApiPerson.pipe(pageOf, mcpToolOutputSchema),
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
            const answer = yield* runQuery(reads.grades, {
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
          "List the released grades of one period, a page at a time. A draft is never listed.",
        input: PeriodPage,
        name: "school_list_grades",
        output: ApiGrade.pipe(pageOf, mcpToolOutputSchema),
        title: "List released grades",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            const { key, period, rows } = yield* decodeAgentInput(
              RosterImport,
              input,
              "Send a key, the period's id, and at most one hundred students."
            );
            const students = yield* Schema.decodeEffect(
              Schema.Array(ImportRow)
            )(rows).pipe(Effect.mapError(() => invalidRows));
            const digest = yield* sha256Hex(
              encodeJsonText({ period, rows })
            ).pipe(Effect.orDie);
            const { runMutation } = yield* MutationRunner;
            const answer = yield* runMutation(
              integrationsInternal.writes.importRoster,
              { clientId, digest, key, period, rows: students }
            ).pipe(Effect.orDie);
            if (answer.outcome === "forbidden") {
              return yield* forbidden;
            }
            if (answer.outcome === "conflict") {
              return yield* keyConflict;
            }
            return answer.summary;
          })
        ),
      tool: new McpSchema.Tool({
        annotations: IMPORT,
        description:
          "Import up to one hundred students into one period, by NISN, as a Dapodik file does. A NISN the school holds updates that student.",
        inputSchema: yield* toMcpInputSchema(RosterImport).pipe(Effect.orDie),
        name: "school_import_roster",
        outputSchema: yield* toMcpOutputSchema(
          ApiImportSummary.pipe(mcpToolOutputSchema)
        ).pipe(Effect.orDie),
        title: "Import students",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            const entry = yield* decodeAgentInput(
              GradeEntry,
              input,
              "Send the class's id, the student's id, and a grade from 0 to 100."
            );
            const { runMutation } = yield* MutationRunner;
            const answer = yield* runMutation(
              integrationsInternal.writes.enterGrade,
              { ...entry, clientId }
            ).pipe(Effect.orDie);
            return yield* Match.value(answer).pipe(
              Match.discriminatorsExhaustive("outcome")({
                entered: ({ grade }) => Effect.succeed(grade),
                forbidden: () => Effect.fail(forbidden),
                notPlaced: () => Effect.fail(notPlaced),
                released: () => Effect.fail(alreadyReleased),
              })
            );
          })
        ),
      tool: new McpSchema.Tool({
        annotations: IMPORT,
        description:
          "Enter a student's draft grade in a class, from 0 to 100. A teacher still releases it, and a released grade stays as it is.",
        inputSchema: yield* toMcpInputSchema(GradeEntry).pipe(Effect.orDie),
        name: "school_enter_grade",
        outputSchema: yield* toMcpOutputSchema(
          ApiGradeDraft.pipe(mcpToolOutputSchema)
        ).pipe(Effect.orDie),
        title: "Enter a grade",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        run(
          Effect.gen(function* () {
            const { cursor } = yield* decodeAgentInput(
              ChangesPage,
              input,
              "Send the cursor of the next page if any."
            );
            const { runQuery } = yield* QueryRunner;
            const answer = yield* runQuery(reads.changes, {
              clientId,
              cursor,
              numItems: PAGE_LIMIT,
            }).pipe(Effect.orDie);
            return yield* pageOr(answer, () => forbidden);
          })
        ),
      tool: yield* readOnlyTool({
        description:
          "List the published changes of the school, oldest first, a page at a time. A page may hold few rows, so follow next until it is null.",
        input: ChangesPage,
        name: "school_list_changes",
        output: ApiChange.pipe(pageOf, mcpToolOutputSchema),
        title: "List changes",
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
        output: ApiPlacement.pipe(pageOf, mcpToolOutputSchema),
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
  readonly services: Context.Context<MutationRunner | QueryRunner>;
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
