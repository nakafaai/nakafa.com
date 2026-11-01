import { type FunctionSpec, type GroupSpec, Spec } from "@confect/core";
import { ConvexConfigProvider } from "@confect/server";
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
import { SCHOOL_MCP_PATH } from "@repo/backend/confect/integrations/api";
import { NakafaAgentInputError } from "@repo/contents/agent/errors";
import { FetchClient } from "@repo/utilities/http/client";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Config,
  Context,
  Effect,
  Layer,
  Match,
  Order,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";
import { McpProtocol, McpSchema, McpServer } from "effect/ai";
import { HttpBody, HttpClient, HttpClientRequest } from "effect/http";

const SERVER_IDENTITY: McpSchema.Implementation = {
  name: "nakafa",
  title: "Nakafa",
  version: "1.0.0",
};

const SERVER_INSTRUCTIONS =
  "Act in Nakafa as the person who signed you in: everything they can read or change in the app, and nothing else. Find a function with nakafa_list_functions, read its arguments with nakafa_describe_function, and run it with nakafa_call_function. School functions name their school in their arguments: tenancy/memberships:list gives the person's schools.";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
};

/** A function runs what its name says, so the tool may change the person's data. */
const CALL = {
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
  readOnlyHint: false,
};

/** One function's name as Convex writes it, such as `tenancy/people:list`. */
const FunctionName = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[A-Za-z0-9_/]+:[A-Za-z0-9_]+$/u))
).annotate({
  description: "The name of a function, from nakafa_list_functions.",
});

const ListInput = Schema.Struct({
  area: Schema.optionalKey(Schema.String).annotate({
    description:
      "An area of Nakafa, such as exams or tenancy. Leave it out to list the areas.",
  }),
});

const DescribeInput = Schema.Struct({ name: FunctionName });

const CallInput = Schema.Struct({
  args: Schema.Record(Schema.String, Schema.Json).annotate({
    description: "The function's arguments, from nakafa_describe_function.",
  }),
  name: FunctionName,
});

const ListOutput = Schema.Struct({
  areas: Schema.Array(Schema.String),
  functions: Schema.Array(
    Schema.Struct({ kind: Schema.String, name: Schema.String })
  ),
});

const DescribeOutput = Schema.Struct({
  args: Schema.Unknown,
  kind: Schema.String,
  name: Schema.String,
});

const CallOutput = Schema.Struct({ value: Schema.Unknown });

/** Convex's answer to one function run over its HTTP API. */
const RunAnswer = Schema.Union([
  Schema.Struct({ status: Schema.Literal("success"), value: Schema.Unknown }),
  Schema.Struct({
    errorMessage: Schema.String,
    status: Schema.Literal("error"),
  }),
]);

/** The tool error of a function name that no public function holds. */
const unknownFunction = new NakafaAgentInputError({
  cause: "No public function has this name.",
  message: "Find the name with nakafa_list_functions.",
});

/** The tool error of a run that never reached an answer. */
const unreachable = () =>
  new NakafaAgentInputError({
    cause: "The function run reached no answer.",
    message: "Nakafa did not answer this call. Try again.",
  });

/** The public functions of one group and the groups inside it, each with its Convex name. */
const entriesOf = (
  group: GroupSpec.AnyWithProps,
  path: string
): ReadonlyArray<readonly [string, FunctionSpec.AnyWithProps]> => [
  ...Arr.map(
    Arr.filter(
      Rec.values(group.functions),
      (spec) => spec.functionVisibility === "public"
    ),
    (spec) => [`${path}:${spec.name}`, spec] as const
  ),
  ...Arr.flatMap(Rec.toEntries(group.groups), ([name, child]) =>
    entriesOf(child, `${path}/${name}`)
  ),
];

/** Every public function of a spec, under the names Convex serves them. */
const entriesOfSpec = (spec: Spec.AnyWithProps) =>
  Arr.flatMap(Rec.toEntries(Spec.groups(spec)), ([name, group]) =>
    entriesOf(group, name)
  );

/**
 * Every public function, read from the whole generated spec. It loads on the first call that
 * needs it and not with the HTTP module, because every HTTP route evaluates that module.
 */
const loadEntries = Effect.promise(
  () => import("@repo/backend/confect/_generated/spec")
).pipe(Effect.map(({ default: spec }) => entriesOfSpec(spec)));

/** What ends the first segment of a function's name. */
const SEGMENT_END = /[/:]/u;

/** The area of one function: the first segment of its name. */
const areaOf = ([name]: readonly [string, FunctionSpec.AnyWithProps]) =>
  Arr.headNonEmpty(Str.split(SEGMENT_END)(name));

const listFunctions = Effect.fn("integrations.agent.list")(function* (
  input: unknown
) {
  const { area } = yield* decodeAgentInput(
    ListInput,
    input,
    "Send an area name, or nothing."
  );
  const entries = yield* loadEntries;
  const areas = Arr.dedupe(Arr.map(entries, areaOf));
  if (area === undefined) {
    return { areas: Arr.sort(areas, Order.String), functions: [] };
  }
  return {
    areas: [area],
    functions: Arr.sort(
      Arr.map(
        Arr.filter(entries, (entry) => areaOf(entry) === area),
        ([name, spec]) => ({
          kind: spec.runtimeAndFunctionType.functionType,
          name,
        })
      ),
      Order.mapInput(
        Order.String,
        (entry: { readonly name: string }) => entry.name
      )
    ),
  };
});

const describeFunction = Effect.fn("integrations.agent.describe")(function* (
  input: unknown
) {
  const { name } = yield* decodeAgentInput(
    DescribeInput,
    input,
    "Send the name of a function."
  );
  const [, spec] = yield* Effect.fromOption(
    Arr.findFirst(yield* loadEntries, ([candidate]) => candidate === name)
  ).pipe(Effect.mapError(() => unknownFunction));
  const { functionProvenance: provenance } = spec;
  return {
    args:
      provenance._tag === "Confect"
        ? Schema.toJsonSchemaDocument(provenance.args).schema
        : {},
    kind: spec.runtimeAndFunctionType.functionType,
    name,
  };
});

/**
 * Runs one public function as the person, over Convex's HTTP API with their own token. That API
 * serves public functions alone and each one decides for its caller, so an agent passes the same
 * checks the web app does, and an internal function answers as if it did not exist.
 */
const callFunction = Effect.fn("integrations.agent.call")(
  function* (token: string, input: unknown) {
    const { args, name } = yield* decodeAgentInput(
      CallInput,
      input,
      "Send the function's name and its arguments."
    );
    const origin = yield* Config.String("CONVEX_CLOUD_URL");
    const path = Str.replaceAll(":", "/")(name);
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.execute(
      HttpClientRequest.post(new URL(`/api/run/${path}`, origin), {
        body: HttpBody.text(
          encodeJsonText({ args, format: "json" }),
          "application/json"
        ),
        headers: { authorization: `Bearer ${token}` },
      })
    );
    const answer = yield* response.json.pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(RunAnswer))
    );
    return yield* Match.value(answer).pipe(
      Match.when({ status: "success" }, ({ value }) =>
        Effect.succeed({ value })
      ),
      Match.when({ status: "error" }, ({ errorMessage }) =>
        Effect.fail(
          new NakafaAgentInputError({
            cause: errorMessage,
            message: errorMessage,
          })
        )
      ),
      Match.exhaustive
    );
  },
  Effect.scoped,
  Effect.provide(Layer.merge(FetchClient, ConvexConfigProvider.layer)),
  Effect.catchTags({
    ConfigError: Effect.die,
    HttpClientError: () => Effect.fail(unreachable()),
    SchemaError: () => Effect.fail(unreachable()),
  })
);

/** One tool definition from its text and its contracts. */
const toolOf = Effect.fn("integrations.agent.tool")(function* (options: {
  readonly annotations: typeof READ_ONLY;
  readonly description: string;
  readonly input: McpObjectContract;
  readonly name: string;
  readonly output: McpObjectContract;
  readonly title: string;
}) {
  return new McpSchema.Tool({
    annotations: options.annotations,
    description: options.description,
    inputSchema: yield* toMcpInputSchema(options.input),
    name: options.name,
    outputSchema: yield* toMcpOutputSchema(options.output),
    title: options.title,
  });
}, Effect.orDie);

/** Registers the three tools that reach every public function, for one signed-in person. */
const registerAgentTools = Effect.fn("integrations.agent.register")(
  function* (options: { readonly requestId: string; readonly token: string }) {
    const { requestId, token } = options;
    const server = yield* McpServer.McpServer;
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) => runMcpTool(listFunctions(input), requestId),
      tool: yield* toolOf({
        annotations: READ_ONLY,
        description:
          "List the areas of Nakafa, or the functions of one area with whether each reads or changes data.",
        input: ListInput,
        name: "nakafa_list_functions",
        output: mcpToolOutputSchema(ListOutput),
        title: "List functions",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        runMcpTool(describeFunction(input), requestId),
      tool: yield* toolOf({
        annotations: READ_ONLY,
        description: "Read the arguments one function takes, as a JSON Schema.",
        input: DescribeInput,
        name: "nakafa_describe_function",
        output: mcpToolOutputSchema(DescribeOutput),
        title: "Describe a function",
      }),
    });
    yield* server.addTool({
      annotations: Context.empty(),
      handle: (input: unknown) =>
        runMcpTool(callFunction(token, input), requestId),
      tool: yield* toolOf({
        annotations: CALL,
        description:
          "Run one function as the signed-in person. It answers and refuses as the app does for them.",
        input: CallInput,
        name: "nakafa_call_function",
        output: mcpToolOutputSchema(CallOutput),
        title: "Call a function",
      }),
    });
  }
);

/** The MCP engine of one request of a signed-in person. */
export function agentMcpEngine(options: {
  readonly allowedOrigins: readonly string[];
  readonly requestId: string;
  readonly token: string;
}) {
  return Layer.effectDiscard(registerAgentTools(options)).pipe(
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
