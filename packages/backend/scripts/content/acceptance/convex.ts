import { LocalDeploymentJson } from "@repo/backend/scripts/content/acceptance/deployment";
import {
  type AcceptanceRuntimeError,
  acceptanceRuntimeError,
  sanitizeAcceptanceCommandError,
} from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Context,
  Duration,
  Effect,
  FileSystem,
  Layer,
  Option,
  Schedule,
  Schema,
} from "effect";
import { Base64 } from "effect/encoding";
import { HttpClient, HttpClientRequest } from "effect/http";

/** The identity a call acts as: a Better Auth session and the user it belongs to. */
const ConvexIdentity = Schema.Struct({
  sessionId: Schema.String,
  subject: Schema.String,
});

/**
 * One call of a Convex function: its path, its arguments as plain JSON, the
 * component that owns it when the app does not, and the identity it acts as
 * when it acts as a learner.
 */
export const ConvexCall = Schema.Struct({
  args: Schema.Unknown,
  component: Schema.optionalKey(Schema.String),
  identity: Schema.optionalKey(ConvexIdentity),
  path: Schema.String,
});

/**
 * Runs one Convex function and answers the value it returned. The runner owns
 * which deployment the call reaches, and keeps `sensitiveValues` out of the
 * errors it reports.
 */
export type RunConvex<E, R> = (
  operation: string,
  call: typeof ConvexCall.Type,
  sensitiveValues?: readonly string[]
) => Effect.Effect<unknown, E, R>;

/** One page of a table, newest first, as `_system/cli/tableData` answers it. */
const TablePage = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(Schema.Unknown),
});

/** The rows one read of a table asks for at a time. */
const TABLE_PAGE_SIZE = 1000;

/**
 * Reads up to `limit` documents of one table, newest first, page by page, as
 * `convex data` reads them, and decodes each with `row`.
 */
export const readRows = Effect.fn("contentAcceptance.readRows")(function* <
  S extends Schema.Top & { readonly DecodingServices: never },
  E,
  R,
>(run: RunConvex<E, R>, table: string, row: S, limit: number) {
  const readPage = (cursor: string | null) =>
    run(`${table} rows`, {
      args: {
        order: "desc",
        paginationOpts: { cursor, numItems: TABLE_PAGE_SIZE },
        table,
      },
      path: "_system/cli/tableData",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(TablePage)));
  const collect = (
    cursor: string | null,
    rows: readonly unknown[]
  ): Effect.Effect<readonly unknown[], E | Schema.SchemaError, R> =>
    readPage(cursor).pipe(
      Effect.flatMap((page) => {
        const read = Arr.appendAll(rows, page.page);
        return page.isDone || read.length >= limit
          ? Effect.succeed(read)
          : collect(page.continueCursor, read);
      })
    );
  const rows = yield* collect(null, []);
  return yield* Schema.decodeEffect(Schema.Array(row))(Arr.take(rows, limit));
});

/**
 * The running local backend of an acceptance runtime, as its admin: one call of
 * a function, and the append of rows to a table, as `convex import --append`
 * writes them, past every function and trigger. A browser test and the command
 * line reach it in their own process, so a fixture costs no process at all.
 */
export class LocalConvex extends Context.Service<
  LocalConvex,
  {
    readonly run: RunConvex<AcceptanceRuntimeError, never>;
    readonly importRows: (
      table: string,
      rows: readonly unknown[]
    ) => Effect.Effect<void, AcceptanceRuntimeError>;
  }
>()("@repo/backend/scripts/content/acceptance/convex/LocalConvex") {}

/** What `/api/function` answers: the value, or the error the function ended with. */
const FunctionAnswer = Schema.Union([
  Schema.Struct({ status: Schema.Literal("success"), value: Schema.Unknown }),
  Schema.Struct({
    errorMessage: Schema.String,
    status: Schema.Literal("error"),
  }),
]);

/** The status the backend answers a function that failed with, beside its error. */
const FUNCTION_FAILED = 560;

/** What the import endpoints answer: the upload, and the import it became. */
const UploadStarted = Schema.Struct({ uploadToken: Schema.String });
const UploadFinished = Schema.Struct({ importId: Schema.String });

/** The states of an import that stand still, as `_system/cli/queryImport` answers them. */
const ImportState = Schema.Struct({
  state: Schema.Union([
    Schema.Struct({
      state: Schema.Literals([
        "uploaded",
        "in_progress",
        "waiting_for_confirmation",
        "completed",
      ]),
    }),
    Schema.Struct({
      error_message: Schema.String,
      state: Schema.Literal("failed"),
    }),
  ]),
});
type ImportPhase = typeof ImportState.Type.state.state;

/** How often a running import is read until it stands still. */
const IMPORT_READ_PAUSE = Duration.millis(250);

/**
 * The local backend at `url`, reached with its admin key through `client`. A
 * call speaks the protocol of the Convex HTTP client, and an import the one of
 * the Convex command line: upload the rows, wait for the import to wait for its
 * confirmation, confirm it, and wait for it to complete.
 * @see https://github.com/get-convex/convex-js/blob/main/src/browser/http_client.ts
 * @see https://github.com/get-convex/convex-js/blob/main/src/cli/lib/convexImport.ts
 */
export function makeLocalConvex(
  client: HttpClient.HttpClient,
  backend: { readonly adminKey: string; readonly url: string }
) {
  const admin = `Convex ${backend.adminKey}`;
  const failure = (
    operation: string,
    detail: string,
    sensitiveValues: readonly string[] = []
  ) =>
    acceptanceRuntimeError(
      `${operation} failed: ${sanitizeAcceptanceCommandError(
        detail,
        [...sensitiveValues, backend.adminKey],
        "start"
      )}`
    );

  /** Sends one request and answers the response that a success status carries. */
  const send = Effect.fn("contentAcceptance.localConvex.send")(function* (
    operation: string,
    request: HttpClientRequest.HttpClientRequest,
    sensitiveValues: readonly string[] = []
  ) {
    const response = yield* client
      .execute(request)
      .pipe(
        Effect.mapError((error) =>
          failure(operation, error.message, sensitiveValues)
        )
      );
    if (response.status !== 200 && response.status !== FUNCTION_FAILED) {
      const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
      return yield* failure(
        operation,
        `${response.status} ${text}`,
        sensitiveValues
      );
    }
    return yield* response.json.pipe(
      Effect.mapError((error) =>
        failure(operation, error.message, sensitiveValues)
      )
    );
  });

  const postJson = (path: string, authorization: string, body: unknown) =>
    HttpClientRequest.post(`${backend.url}${path}`).pipe(
      HttpClientRequest.setHeader("Authorization", authorization),
      HttpClientRequest.bodyJsonUnsafe(body)
    );

  const decode = <S extends Schema.Top & { readonly DecodingServices: never }>(
    operation: string,
    schema: S,
    value: unknown
  ) =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.mapError((error) => failure(operation, error.message))
    );

  const run: RunConvex<AcceptanceRuntimeError, never> = Effect.fn(
    "contentAcceptance.localConvex.run"
  )(function* (operation, call, sensitiveValues = []) {
    // An admin acts as a learner by naming the identity after its key, as the HTTP client does.
    const authorization = Option.match(Option.fromUndefinedOr(call.identity), {
      onNone: () => admin,
      onSome: (identity) =>
        `${admin}:${Base64.encode(encodeJsonText(identity))}`,
    });
    const answered = yield* send(
      operation,
      postJson("/api/function", authorization, {
        args: call.args,
        componentPath: call.component,
        format: "json",
        path: call.path,
      }),
      sensitiveValues
    );
    const answer = yield* decode(operation, FunctionAnswer, answered);
    if (answer.status === "error") {
      return yield* failure(operation, answer.errorMessage, sensitiveValues);
    }
    return answer.value;
  });

  /** Reads the import until it reaches a phase in `until`, answers that phase, and fails when it failed. */
  const settle = Effect.fn("contentAcceptance.localConvex.settle")(function* (
    operation: string,
    importId: string,
    until: readonly ImportPhase[]
  ) {
    const read = run(operation, {
      args: { importId },
      path: "_system/cli/queryImport",
    }).pipe(Effect.flatMap((value) => decode(operation, ImportState, value)));
    const { state } = yield* read.pipe(
      Effect.repeat({
        schedule: Schedule.spaced(IMPORT_READ_PAUSE),
        until: ({ state: phase }) =>
          phase.state === "failed" || Arr.contains(until, phase.state),
      })
    );
    if (state.state === "failed") {
      return yield* failure(operation, state.error_message);
    }
    return state.state;
  });

  const importRows = Effect.fn("contentAcceptance.localConvex.import")(
    function* (table: string, rows: readonly unknown[]) {
      const operation = `${table} import`;
      const { uploadToken } = yield* send(
        operation,
        HttpClientRequest.post(`${backend.url}/api/import/start_upload`).pipe(
          HttpClientRequest.setHeader("Authorization", admin)
        )
      ).pipe(
        Effect.flatMap((value) => decode(operation, UploadStarted, value))
      );
      const lines = Arr.join(
        Arr.map(rows, (row) => encodeJsonText(row)),
        "\n"
      );
      const partToken = yield* send(
        operation,
        HttpClientRequest.post(`${backend.url}/api/import/upload_part`).pipe(
          HttpClientRequest.setHeader("Authorization", admin),
          HttpClientRequest.setUrlParams({ partNumber: "1", uploadToken }),
          HttpClientRequest.bodyText(lines, "application/octet-stream")
        )
      );
      const { importId } = yield* send(
        operation,
        postJson("/api/import/finish_upload", admin, {
          import: { format: "jsonLines", mode: "append", tableName: table },
          partTokens: [partToken],
          uploadToken,
        })
      ).pipe(
        Effect.flatMap((value) => decode(operation, UploadFinished, value))
      );
      const uploaded = yield* settle(operation, importId, [
        "waiting_for_confirmation",
        "completed",
      ]);
      // An import that needs no confirmation is complete already, as the CLI finds it.
      if (uploaded === "completed") {
        return;
      }
      yield* send(
        operation,
        postJson("/api/perform_import", admin, { importId })
      );
      yield* settle(operation, importId, ["completed"]);
    }
  );

  return LocalConvex.of({ importRows, run });
}

/**
 * The local backend of the running acceptance runtime of the checkout at
 * `root`, reached over HTTP as its admin. The runtime's manifest names its
 * address, and the deployment that `convex init` saved holds its key.
 */
export const localConvexLayer = (root: string) =>
  Layer.effect(
    LocalConvex,
    Effect.gen(function* () {
      const runtime = yield* readLocalRuntime(root);
      if (runtime === undefined) {
        return yield* acceptanceRuntimeError(
          "Run bun run acceptance:prepare and start acceptance before seeding the local runtime."
        );
      }
      const deployment = yield* (yield* FileSystem.FileSystem)
        .readFileString(`${runtime.backend}/.convex/local/default/config.json`)
        .pipe(Effect.flatMap(Schema.decodeEffect(LocalDeploymentJson)));
      return makeLocalConvex(yield* HttpClient.HttpClient, {
        adminKey: deployment.adminKey,
        url: runtime.query,
      });
    })
  );
