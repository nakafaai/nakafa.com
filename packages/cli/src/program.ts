import { Effect } from "effect";
import { type FetchImplementation, requestNakafaApi } from "./client.js";
import {
  type CliCommand,
  type CliRequest,
  HELP_TEXT,
  readCliRequest,
} from "./command.js";
import type {
  ApiResponseError,
  NetworkError,
  ResponseDecodeError,
} from "./error.js";

const INVOCATION_EXIT_CODE = 2;
const API_EXIT_CODE = 3;
const NETWORK_OR_SERVER_EXIT_CODE = 4;
const MCP_ENDPOINT = "https://mcp.nakafa.com/mcp";

export interface CliDependencies {
  readonly fetchImplementation: FetchImplementation;
  readonly stderr: { write(value: string): unknown };
  readonly stdout: { write(value: string): unknown };
  readonly version: string;
}

interface CliOutput {
  readonly kind: "json" | "text";
  readonly value: unknown;
}

/** Executes one CLI invocation and returns its stable process exit category. */
export function runCli(argv: readonly string[], dependencies: CliDependencies) {
  return executeCli(argv, dependencies).pipe(
    Effect.catchTags({
      ApiResponseError: (error) =>
        writeJson(dependencies.stderr, error.problem, false).pipe(
          Effect.as(
            error.status >= 500 ? NETWORK_OR_SERVER_EXIT_CODE : API_EXIT_CODE
          )
        ),
      InvocationError: (error) =>
        writeJson(
          dependencies.stderr,
          { code: "INVOCATION_ERROR", message: error.message },
          false
        ).pipe(Effect.as(INVOCATION_EXIT_CODE)),
      NetworkError: (error) =>
        writeJson(
          dependencies.stderr,
          { code: "NETWORK_ERROR", message: error.message },
          false
        ).pipe(Effect.as(NETWORK_OR_SERVER_EXIT_CODE)),
      ResponseDecodeError: (error) =>
        writeJson(
          dependencies.stderr,
          {
            code: "INVALID_SERVER_RESPONSE",
            message: error.message,
            status: error.status,
          },
          false
        ).pipe(Effect.as(NETWORK_OR_SERVER_EXIT_CODE)),
    })
  );
}

const executeCli = Effect.fn("nakafaCli.execute")(function* (
  argv: readonly string[],
  dependencies: CliDependencies
) {
  const request = yield* readCliRequest(argv);
  const output = yield* executeCommand(request, dependencies);
  if (output.kind === "text") {
    yield* writeText(dependencies.stdout, String(output.value));
    return 0;
  }
  yield* writeJson(dependencies.stdout, output.value, request.pretty);
  return 0;
});

function executeCommand(
  request: CliRequest,
  dependencies: CliDependencies
): Effect.Effect<
  CliOutput,
  ApiResponseError | NetworkError | ResponseDecodeError
> {
  const command = request.command;
  if (command.kind === "help") {
    return Effect.succeed({ kind: "text", value: HELP_TEXT });
  }
  if (command.kind === "version") {
    return Effect.succeed({ kind: "text", value: `${dependencies.version}\n` });
  }
  if (command.kind === "mcp") {
    return Effect.succeed({
      kind: "json",
      value: {
        endpoint: MCP_ENDPOINT,
        manifest: MCP_ENDPOINT,
        protocol_version: "2026-07-28",
        transport: "streamable-http",
      },
    });
  }
  return requestNakafaApi({
    apiBase: request.apiBase,
    fetchImplementation: dependencies.fetchImplementation,
    path: buildApiPath(command),
  }).pipe(Effect.map((value) => ({ kind: "json", value })));
}

function buildApiPath(
  command: Exclude<CliCommand, { kind: "help" | "mcp" | "version" }>
) {
  if (command.kind === "get") {
    const query = new URLSearchParams({ ref: command.ref });
    return `/v1/content?${query}`;
  }
  if (command.kind === "taxonomy") {
    const query = new URLSearchParams();
    appendOptional(query, "locale", command.locale);
    return withQuery("/v1/taxonomy", query);
  }
  if (command.kind === "quran") {
    const query = new URLSearchParams();
    appendOptional(query, "from_verse", command.fromVerse);
    appendOptional(query, "to_verse", command.toVerse);
    appendOptional(query, "locale", command.locale);
    if (command.includeTafsir) {
      query.set("include_tafsir", "true");
    }
    return withQuery(`/v1/quran/${command.surah}`, query);
  }
  const query = new URLSearchParams({ query: command.query });
  appendOptional(query, "section", command.section);
  appendOptional(query, "locale", command.locale);
  appendOptional(query, "limit", command.limit);
  appendOptional(query, "offset", command.offset);
  return `/v1/search?${query}`;
}

function appendOptional(
  query: URLSearchParams,
  name: string,
  value: number | string | undefined
) {
  if (value !== undefined) {
    query.set(name, String(value));
  }
}

function withQuery(path: string, query: URLSearchParams) {
  const source = query.toString();
  return source.length === 0 ? path : `${path}?${source}`;
}

function writeJson(
  output: CliDependencies["stdout"],
  value: unknown,
  pretty: boolean
) {
  return writeText(output, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

function writeText(output: CliDependencies["stdout"], value: string) {
  return Effect.sync(() => {
    output.write(value);
  });
}
