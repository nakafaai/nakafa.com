import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  type JsonObject,
  JsonObjectSchema,
} from "@repo/backend/scripts/content/runtime/ci/json";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import stripAnsi from "strip-ansi";

const MAX_COMMAND_ERROR_LENGTH = 500;
export const CONTENT_RUNTIME_TABLE_PAGE_SIZE = 4096;
const WHITESPACE = /\s+/u;
const SHARED_OUTPUT_REDIRECT =
  'output_path=$1; shift; exec "$@" >| "$output_path" 2>&1';
const SPLIT_OUTPUT_REDIRECT =
  'stdout_path=$1; stderr_path=$2; shift 2; exec "$@" >| "$stdout_path" 2>| "$stderr_path"';
const CONVEX_TABLE_DATA_QUERY = makeFunctionReference<
  "query",
  {
    order: "asc" | "desc";
    paginationOpts: {
      cursor: null | string;
      numItems: number;
    };
    table: string;
  },
  unknown
>("_system/cli/tableData");
const ConvexTablePageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(JsonObjectSchema),
});

interface ConvexTablePageRequest {
  readonly cursor: null | string;
  readonly numItems: number;
}

type ReadConvexTablePage = (
  request: ConvexTablePageRequest
) => Promise<unknown>;

export const sanitizeRuntimeCommandError = (
  text: string,
  sensitiveValues: readonly string[]
) => {
  let sanitized = stripAnsi(text);

  for (const sensitiveValue of sensitiveValues) {
    if (sensitiveValue.length > 0) {
      sanitized = sanitized.replaceAll(sensitiveValue, "[redacted]");
    }
  }

  return sanitized
    .trim()
    .split(WHITESPACE)
    .join(" ")
    .slice(0, MAX_COMMAND_ERROR_LENGTH);
};

const productionReadError = (
  table: string,
  cause: unknown,
  sensitiveValues: readonly string[]
) => {
  const detail = sanitizeRuntimeCommandError(
    cause instanceof Error ? cause.message : String(cause),
    sensitiveValues
  );
  const message = `Production read for ${table} failed`;

  return contentRuntimeCiError(
    detail.length > 0 ? `${message}: ${detail}` : `${message}.`
  );
};

export const collectConvexTableRows = Effect.fn(
  "contentRuntime.collectProductionTable"
)(function* (options: {
  readonly limit: number;
  readonly readPage: ReadConvexTablePage;
  readonly sensitiveValues?: readonly string[];
  readonly table: string;
}) {
  const rows: JsonObject[] = [];
  const cursors = new Set<string>();
  let cursor: null | string = null;

  while (rows.length < options.limit) {
    const numItems = Math.min(
      CONTENT_RUNTIME_TABLE_PAGE_SIZE,
      options.limit - rows.length
    );
    const rawPage = yield* Effect.tryPromise({
      catch: (cause) =>
        productionReadError(
          options.table,
          cause,
          options.sensitiveValues ?? []
        ),
      try: () => options.readPage({ cursor, numItems }),
    });
    const page = yield* Schema.decodeUnknownEffect(ConvexTablePageSchema)(
      rawPage
    ).pipe(
      Effect.mapError(() =>
        contentRuntimeCiError(
          `Production read for ${options.table} returned invalid pagination data.`
        )
      )
    );

    const remaining = options.limit - rows.length;
    rows.push(...page.page.slice(0, remaining));
    if (page.isDone || page.page.length >= remaining) {
      return rows;
    }
    if (
      page.page.length === 0 ||
      page.continueCursor.length === 0 ||
      page.continueCursor === cursor ||
      cursors.has(page.continueCursor)
    ) {
      return yield* contentRuntimeCiError(
        `Production read for ${options.table} returned an invalid pagination cursor.`
      );
    }

    cursors.add(page.continueCursor);
    cursor = page.continueCursor;
  }

  return rows;
});

interface RuntimeCommand {
  readonly args: readonly string[];
  readonly command: string;
  readonly deployKey?: string;
  readonly operation: string;
  readonly reportStderr?: boolean;
  readonly sensitiveValues?: readonly string[];
  readonly stderrPath: string;
  readonly stdin?: string;
  readonly stdoutPath: string;
}

/**
 * Runs one runtime command with mode-600 output captured at process startup.
 * Paths and arguments stay positional so the shell never reparses them.
 * @see https://github.com/Effect-TS/effect/blob/66114151c2b4640bf773f2b3456ce70d679422f6/packages/effect/src/unstable/process/ChildProcess.ts
 * @see https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html#tag_19_07
 */
export const runRuntimeCommand = Effect.fn("contentRuntime.runCommand")(
  function* (spec: RuntimeCommand) {
    const fileSystem = yield* FileSystem.FileSystem;
    const sharedOutput = spec.stdoutPath === spec.stderrPath;

    yield* fileSystem.writeFileString(spec.stdoutPath, "", { mode: 0o600 });
    yield* fileSystem.chmod(spec.stdoutPath, 0o600);
    if (!sharedOutput) {
      yield* fileSystem.writeFileString(spec.stderrPath, "", { mode: 0o600 });
      yield* fileSystem.chmod(spec.stderrPath, 0o600);
    }

    const redirectScript = sharedOutput
      ? SHARED_OUTPUT_REDIRECT
      : SPLIT_OUTPUT_REDIRECT;
    const outputPaths = sharedOutput
      ? [spec.stdoutPath]
      : [spec.stdoutPath, spec.stderrPath];
    const stdin =
      spec.stdin === undefined
        ? "ignore"
        : Stream.succeed(new TextEncoder().encode(spec.stdin));
    const command = ChildProcess.make(
      "sh",
      [
        "-c",
        redirectScript,
        "content-runtime-command",
        ...outputPaths,
        spec.command,
        ...spec.args,
      ],
      {
        env: {
          CONTENT_RUNTIME_CACHE_KEY: "",
          CONVEX_DEPLOY_KEY: spec.deployKey ?? "",
          CONVEX_DEPLOYMENT_TOKEN: "",
        },
        extendEnv: true,
        stderr: "ignore",
        stdin,
        stdout: "ignore",
      }
    );
    const childProcess = yield* command;
    const exitCode = yield* childProcess.exitCode;
    if (exitCode !== 0) {
      if (spec.reportStderr) {
        const stderr = yield* fileSystem.readFileString(spec.stderrPath);
        const detail = sanitizeRuntimeCommandError(
          stderr,
          spec.sensitiveValues ?? []
        );

        if (detail.length > 0) {
          return yield* contentRuntimeCiError(
            `${spec.operation} failed: ${detail}`
          );
        }
      }

      return yield* contentRuntimeCiError(`${spec.operation} failed.`);
    }
  }
);

export const runConvexData = Effect.fn("contentRuntime.readProductionTable")(
  function* (options: {
    readonly deployKey: string;
    readonly limit: number;
    readonly logPath: string;
    readonly outputPath: string;
    readonly table: string;
  }) {
    const fileSystem = yield* FileSystem.FileSystem;
    const outputPaths = new Set([options.logPath, options.outputPath]);

    for (const path of outputPaths) {
      yield* fileSystem.writeFileString(path, "", { mode: 0o600 });
      yield* fileSystem.chmod(path, 0o600);
    }

    const client = new ConvexHttpClient(
      `https://${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}.convex.cloud`,
      { logger: false }
    );
    client.setDebug(false);
    client.setAdminAuth(options.deployKey);

    const rows = yield* collectConvexTableRows({
      limit: options.limit,
      readPage: ({ cursor, numItems }) =>
        client.query(CONVEX_TABLE_DATA_QUERY, {
          order: "desc",
          paginationOpts: { cursor, numItems },
          table: options.table,
        }),
      sensitiveValues: [options.deployKey],
      table: options.table,
    }).pipe(Effect.ensuring(Effect.sync(() => client.clearAuth())));

    yield* fileSystem.writeFileString(options.outputPath, JSON.stringify(rows), {
      mode: 0o600,
    });
    yield* fileSystem.chmod(options.outputPath, 0o600);
  }
);

export const runConvexImport = Effect.fn("contentRuntime.importLocalTable")(
  function* (options: {
    readonly inputPath: string;
    readonly logPath: string;
    readonly table: string;
  }) {
    yield* runRuntimeCommand({
      args: [
        "exec",
        "convex",
        "import",
        "--format",
        "jsonLines",
        "--table",
        options.table,
        "--replace",
        "--yes",
        options.inputPath,
      ],
      command: "pnpm",
      operation: `Local import for ${options.table}`,
      stderrPath: options.logPath,
      stdoutPath: options.logPath,
    });
  }
);
