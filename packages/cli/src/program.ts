import {
  NAKAFA_MCP_PROTOCOL_VERSION,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { Console, Effect, Layer, MutableRef } from "effect";
import {
  CliConfig,
  CliError,
  CliOutput,
  Command,
  GlobalFlag,
} from "effect/unstable/cli";
import { requestNakafaApi } from "#cli/client";
import type { CliCommand, CliRequest } from "#cli/command/spec";
import { makeCliCommand } from "#cli/command/tree";
import { makeInvocationError } from "#cli/error";
import { writeJson } from "#cli/output";

const INVOCATION_EXIT_CODE = 2;
const API_EXIT_CODE = 3;
const NETWORK_OR_SERVER_EXIT_CODE = 4;

export interface CliOptions {
  readonly version: string;
}

/** Executes one CLI invocation and returns its stable process exit category. */
export function runCli(argv: readonly string[], options: CliOptions) {
  return executeCli(argv.length === 0 ? ["--help"] : argv, options).pipe(
    Effect.catchTags({
      ApiResponseError: (error) =>
        writeJson("stderr", error.problem, false).pipe(
          Effect.as(
            error.status >= 500 ? NETWORK_OR_SERVER_EXIT_CODE : API_EXIT_CODE
          )
        ),
      InvocationError: (error) =>
        writeJson(
          "stderr",
          { code: "INVOCATION_ERROR", message: error.message },
          false
        ).pipe(Effect.as(INVOCATION_EXIT_CODE)),
      HttpResponseError: (error) =>
        writeJson(
          "stderr",
          {
            code: "HTTP_RESPONSE_ERROR",
            ...(error.retryAfter === undefined
              ? {}
              : { retry_after: error.retryAfter }),
            status: error.status,
          },
          false
        ).pipe(
          Effect.as(
            error.status >= 500 ? NETWORK_OR_SERVER_EXIT_CODE : API_EXIT_CODE
          )
        ),
      NetworkError: (error) =>
        writeJson(
          "stderr",
          { code: "NETWORK_ERROR", message: error.message },
          false
        ).pipe(Effect.as(NETWORK_OR_SERVER_EXIT_CODE)),
      ResponseDecodeError: (error) =>
        writeJson(
          "stderr",
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

const executeCli = Effect.fn("NakafaCli.execute")(function* (
  argv: readonly string[],
  options: CliOptions
) {
  const command = makeCliCommand((request) => executeRequest(request));
  const hostConsole = yield* Console.Console;
  const messages = MutableRef.make<readonly (readonly unknown[])[]>([]);
  // The native runner always renders help before a ShowHelp failure. Buffer
  // that output so invocation errors keep stdout empty for machine consumers.
  const commandConsole: Console.Console = Object.assign(
    Object.create(hostConsole),
    {
      log: (...args: readonly unknown[]) => {
        MutableRef.update(messages, (current) => [...current, args]);
      },
    }
  );
  const flushMessages = Effect.suspend(() =>
    Effect.forEach(
      MutableRef.get(messages),
      (message) => Console.log(...message),
      { discard: true }
    )
  );
  yield* Command.runWith(command, {
    renderErrors: false,
    version: options.version,
  })(argv).pipe(
    Effect.provide(cliRuntimeLayer),
    Effect.provideService(Console.Console, commandConsole),
    Effect.matchEffect({
      onFailure: (error) => {
        if (
          CliError.isCliError(error) &&
          error._tag === "ShowHelp" &&
          error.errors.length === 0
        ) {
          return flushMessages;
        }
        return CliError.isCliError(error)
          ? Effect.fail(makeInvocationError(error))
          : Effect.fail(error);
      },
      onSuccess: () => flushMessages,
    })
  );
  return 0;
});

const executeRequest = Effect.fn("NakafaCli.executeRequest")(function* (
  request: CliRequest
) {
  const output = yield* executeCommand(request);
  yield* writeJson("stdout", output, request.pretty);
});

function executeCommand(request: CliRequest) {
  const command = request.command;
  if (command.kind === "mcp") {
    return Effect.succeed({
      endpoint: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
      protocol_version: NAKAFA_MCP_PROTOCOL_VERSION,
      transport: "streamable-http",
    });
  }
  return requestNakafaApi({
    apiBase: request.apiBase,
    path: buildApiPath(command),
  });
}

function buildApiPath(command: Exclude<CliCommand, { kind: "mcp" }>) {
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

const plainFormatter = CliOutput.defaultFormatter({ colors: false });
const cliRuntimeLayer = Layer.merge(
  CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] }),
  CliOutput.layer({
    ...plainFormatter,
    formatVersion: (_name, version) => version,
  })
);

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
